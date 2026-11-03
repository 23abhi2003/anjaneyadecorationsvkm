import type { StaffAssignmentRecord, StaffBorrow, StaffPayment, StaffPaymentStatus } from "@/lib/types";

/**
 * Staff payout maths, shared by the Staff cards, the assignments page and the
 * order page so they can never disagree.
 *
 * For one assignment:
 *   total    what the staff member is owed for the job
 *   advances what the owner already handed over before the final payment
 *   due      what is still owed  (0 once the assignment is marked "paid")
 *   paid     what has been settled (advances while due; the full total once "paid")
 */

export function parseAmt(v: string | number | undefined | null): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function sumAdvances(payments?: StaffPayment[]): number {
  return (payments ?? []).reduce((sum, p) => sum + parseAmt(p.amount), 0);
}

export interface AssignmentMoney {
  total: number;
  advances: number;
  paid: number;
  due: number;
  status: StaffPaymentStatus;
}

export function assignmentMoney(a: {
  amount?: string;
  paymentStatus?: StaffPaymentStatus;
  payments?: StaffPayment[];
}): AssignmentMoney {
  const total = parseAmt(a.amount);
  const advances = sumAdvances(a.payments);
  const status: StaffPaymentStatus = a.paymentStatus === "paid" ? "paid" : "due";
  if (status === "paid") return { total, advances, paid: total, due: 0, status };
  const paid = Math.min(advances, total);
  return { total, advances, paid, due: Math.max(total - paid, 0), status };
}

export function summarizeAssignments(
  list: Array<{ amount?: string; paymentStatus?: StaffPaymentStatus; payments?: StaffPayment[] }>
): { total: number; paid: number; due: number } {
  return list.reduce(
    (acc, a) => {
      const m = assignmentMoney(a);
      return { total: acc.total + m.total, paid: acc.paid + m.paid, due: acc.due + m.due };
    },
    { total: 0, paid: 0, due: 0 }
  );
}

/** Every borrow ever recorded, repaid or not. */
export function sumBorrows(borrows?: StaffBorrow[]): number {
  return (borrows ?? []).reduce((sum, b) => sum + parseAmt(b.amount), 0);
}

/** Borrows still "due" (missing status = due) — the only ones that count against the active balance. */
export function sumOutstandingBorrows(borrows?: StaffBorrow[]): number {
  return (borrows ?? []).reduce(
    (sum, b) => sum + (b.paymentStatus === "paid" || b.paymentStatus === "settled" ? 0 : parseAmt(b.amount)),
    0
  );
}

/** Borrows the staff member has already repaid outside payroll (paid). */
export function sumRepaidBorrows(borrows?: StaffBorrow[]): number {
  return (borrows ?? []).reduce((sum, b) => sum + (b.paymentStatus === "paid" ? parseAmt(b.amount) : 0), 0);
}

/** Borrows that were cleared in a settlement batch (settled). */
export function sumSettledBorrows(borrows?: StaffBorrow[]): number {
  return (borrows ?? []).reduce((sum, b) => sum + (b.paymentStatus === "settled" ? parseAmt(b.amount) : 0), 0);
}

export type AssignmentSort = "newest" | "oldest";

/** Numeric part of an order id (ADVKM-0042 -> 42), used only to break ties between same-day orders. */
function orderSeq(orderId: string): number {
  const m = /(\d+)\s*$/.exec(orderId);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Sorts assignments by event date. "newest" = present to past (default), "oldest" = past to
 * present. Assignments with no date always sit at the bottom, whichever way you sort. Same-day
 * orders fall back to order number so the order is stable.
 */
export function sortAssignmentsByDate<T extends { orderId: string; date?: string }>(
  list: T[],
  order: AssignmentSort
): T[] {
  const dir = order === "newest" ? -1 : 1;
  return [...list].sort((a, b) => {
    const da = a.date ? Date.parse(a.date) : NaN;
    const db = b.date ? Date.parse(b.date) : NaN;
    const aValid = Number.isFinite(da);
    const bValid = Number.isFinite(db);
    if (!aValid && !bValid) return dir * (orderSeq(a.orderId) - orderSeq(b.orderId));
    if (!aValid) return 1;
    if (!bValid) return -1;
    if (da !== db) return dir * (da - db);
    return dir * (orderSeq(a.orderId) - orderSeq(b.orderId));
  });
}

/** Order filter: matches the order id, program or customer name (case-insensitive, partial). */
export function matchesOrderQuery<T extends { orderId: string; program?: string; customerName?: string }>(
  a: T,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [a.orderId, a.program, a.customerName].some((f) => (f || "").toLowerCase().includes(q));
}

export interface StaffBalance {
  /** Sum of the amounts of ALL orders assigned to the staff member. */
  total: number;
  /** Borrows still outstanding (due) — this is what reduces `remaining`. */
  borrowed: number;
  /** Every borrow ever recorded, repaid or not — for display only. */
  borrowedTotal: number;
  /** Borrows the staff member has already repaid in cash (outside payroll). */
  repaid: number;
  /** Borrows cleared in a settlement batch. */
  settled: number;
  /** total - borrowed (outstanding only). Negative when they've borrowed more than earned so far. */
  remaining: number;
}

/**
 * Borrows are deducted from the total of ALL the staff member's assigned orders
 * (never a date-filtered subset), so pass their full `assignments` list here.
 * Only borrows still marked "due" count against `remaining`.
 */
export function staffBalance(
  assignments: Array<{ amount?: string; paymentStatus?: StaffPaymentStatus; payments?: StaffPayment[] }> | undefined,
  borrows: StaffBorrow[] | undefined
): StaffBalance {
  const { total } = summarizeAssignments(assignments ?? []);
  const borrowed = sumOutstandingBorrows(borrows);
  const borrowedTotal = sumBorrows(borrows);
  const repaid = sumRepaidBorrows(borrows);
  const settled = sumSettledBorrows(borrows);
  return { total, borrowed, borrowedTotal, repaid, settled, remaining: Math.round((total - borrowed) * 100) / 100 };
}

/** ₹12,500 style (Indian digit grouping). Negatives read as -₹500. */
export function inr(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return n < 0 ? `-₹${abs}` : `₹${abs}`;
}

/** Today's date as YYYY-MM-DD in the user's own time zone (not UTC). */
export function todayLocalISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

export interface StaffSettlementSummary {
  settlementNumber: number;
  assignments: StaffAssignmentRecord[];
  borrows: StaffBorrow[];
  total: number;
  borrowsTotal: number;
  netTotal: number;
  settledAt?: string;
  orderCount: number;
  borrowCount: number;
  startDate?: string;
  endDate?: string;
}

export function groupAssignmentsBySettlement(
  assignments?: StaffAssignmentRecord[],
  borrows?: StaffBorrow[]
): {
  settlements: StaffSettlementSummary[];
  totalSettledAmount: number;
  totalSettledOrders: number;
  totalSettledBorrows: number;
} {
  const orderMap = new Map<number, StaffAssignmentRecord[]>();
  for (const a of assignments ?? []) {
    if (a.settlementNumber != null && Number(a.settlementNumber) > 0) {
      const num = Number(a.settlementNumber);
      const list = orderMap.get(num) ?? [];
      list.push(a);
      orderMap.set(num, list);
    }
  }

  const borrowMap = new Map<number, StaffBorrow[]>();
  for (const b of borrows ?? []) {
    if (b.settlementNumber != null && Number(b.settlementNumber) > 0) {
      const num = Number(b.settlementNumber);
      const list = borrowMap.get(num) ?? [];
      list.push(b);
      borrowMap.set(num, list);
    }
  }

  // All unique settlement numbers
  const allNums = new Set<number>([...orderMap.keys(), ...borrowMap.keys()]);
  const settlements: StaffSettlementSummary[] = [];
  let totalSettledAmount = 0;
  let totalSettledOrders = 0;
  let totalSettledBorrows = 0;

  for (const num of allNums) {
    const oList = orderMap.get(num) ?? [];
    const bList = borrowMap.get(num) ?? [];

    const total = oList.reduce((sum, a) => sum + parseAmt(a.amount), 0);
    const borrowsTotal = bList.reduce((sum, b) => sum + parseAmt(b.amount), 0);
    const netTotal = total - borrowsTotal;

    const settledAt =
      oList.find((a) => a.settledAt)?.settledAt ||
      bList.find((b) => b.settledAt)?.settledAt ||
      oList[0]?.date ||
      bList[0]?.date;

    const validDates = [
      ...oList.map((a) => a.date),
      ...bList.map((b) => b.date),
    ]
      .filter((d): d is string => !!d && d.trim() !== "")
      .sort();

    const startDate = validDates.length > 0 ? validDates[0] : settledAt;
    const endDate = validDates.length > 0 ? validDates[validDates.length - 1] : settledAt;

    settlements.push({
      settlementNumber: num,
      assignments: oList,
      borrows: bList,
      total,
      borrowsTotal,
      netTotal,
      settledAt,
      orderCount: oList.length,
      borrowCount: bList.length,
      startDate,
      endDate,
    });

    totalSettledAmount += total;
    totalSettledOrders += oList.length;
    totalSettledBorrows += bList.length;
  }

  // Sort descending by settlement number (latest first)
  settlements.sort((a, b) => b.settlementNumber - a.settlementNumber);

  return { settlements, totalSettledAmount, totalSettledOrders, totalSettledBorrows };
}

export function nextSettlementNumber(staff: {
  lastSettlement?: number;
  assignments?: StaffAssignmentRecord[];
  borrows?: StaffBorrow[];
}): number {
  const maxAssigned = (staff.assignments || []).reduce(
    (max, a) => Math.max(max, Number(a.settlementNumber) || 0),
    0
  );
  const maxBorrowed = (staff.borrows || []).reduce(
    (max, b) => Math.max(max, Number(b.settlementNumber) || 0),
    0
  );
  const maxKnown = Math.max(staff.lastSettlement || 0, maxAssigned, maxBorrowed);
  return maxKnown === 0 ? 1 : maxKnown + 1;
}
