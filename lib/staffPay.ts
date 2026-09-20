import type { StaffPayment, StaffPaymentStatus } from "@/lib/types";

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

/** ₹12,500 style (Indian digit grouping). */
export function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Today's date as YYYY-MM-DD in the user's own time zone (not UTC). */
export function todayLocalISO(): string {
  return new Date().toLocaleDateString("en-CA");
}