export type ServiceType = "tenthouse" | "decoration" | "both" | "";

export type OrderStatus = "pending" | "confirmed" | "completed";

export type CompletionStatus = "pending" | "completed";

export type CustomerType = "new" | "older";

export type Role = "owner" | "staff";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  type: CustomerType;
  address: string;
  location: GeoLocation | null;
  /** Who referred this customer (free text, optional). */
  referredBy?: string;
}

export interface ProgramInfo {
  type: string;
  name: string;
  images: string[];
}


/** Maps an option label (e.g. "4x8", "50kg") to a free-text quantity. */
export type QtyMap = Record<string, string>;

export interface BowlsInfo {
  Baghoni: QtyMap;
  Anda: QtyMap;
  Lagan: QtyMap;
  kanchudu: QtyMap;
}
export interface TenthouseInfo {
  tents: QtyMap;
  bowls: BowlsInfo;
  tablesBig: string;
  tablesSmall: string;
  chairs: string;
  riceDishes: string;
  riceSpoons: string;
  curryBuckets: string;
  currySpoons: string;
  curryDonga: string;
  kabgir: string;
  jallithati: string;
  jalligante: string;
  jugs: string;
  kanchudu: string;
  stoveType: string;
  stands: string;
  drums: string;
  ledLights: string;
  djBoxes: string;
  woodenTables: string;
  wireboxes: string;
  /** Extra items typed in on the "Tables, chairs & utensils" step, beyond the fixed fields above. */
  utensilsExtra: QtyMap;
  /** Extra items typed in on the "Stoves, stands & lighting" step, beyond the fixed fields above. */
  extrasExtra: QtyMap;
}

export interface DecorationInfo {
  frames: QtyMap;
  woodenTables: string;
  mats: string;
  stageClothType: string;
  stageClothColor: string;
  stageClothQty: string;
  djBoxes: string;
  ledLights: string;
  /** Poles, god idols, peacocks, kaman, haldhi chairs, gangalam, kujjalu, decoration sofa, etc. */
  fiberItems: QtyMap;
  ceiling: QtyMap;
  sidewalls: string;
  ceilingPoles: QtyMap;
  flowers: QtyMap;
  /** Extra items typed in on the "Frames, stage & lighting" step, beyond the fixed fields above. */
  framesExtra: QtyMap;
}

/** Has the owner fully settled what a staff member is owed for one job? ("paid" = fully settled) */
export type StaffPaymentStatus = "due" | "paid";

/** One advance the owner handed to a staff member before the final settlement. */
export interface StaffPayment {
  id: string;
  /** Rupees, as a string (like every other amount in the app). */
  amount: string;
  /** YYYY-MM-DD */
  date: string;
  /** "UPI" | "Cash" | "Other" */
  mode: string;
  note: string;
  createdAt?: string;
}

/**
 * Money a staff member borrowed from the owner. Unlike a `StaffPayment` (an advance
 * against ONE order), a borrow belongs to the staff member: it is deducted from the
 * total of ALL their assigned orders.  remaining = total of orders - borrowed
 */
export interface StaffBorrow {
  id: string;
  /** Rupees, as a string (like every other amount in the app). */
  amount: string;
  /** YYYY-MM-DD — the day the money was handed over. */
  date: string;
  /** Why they borrowed it. */
  reason: string;
  /**
   * Has this borrow been repaid (in cash, outside payroll)? "due" (default,
   * missing = due) still counts against the staff member's remaining
   * balance; "paid" is settled and excluded. Owner-only to edit.
   */
  paymentStatus?: StaffPaymentStatus;
  createdAt?: string;
}

export interface StaffAssignment {
  staffId: string;
  name: string;
  amount: string;
  /** Managed by the server. Missing on older orders -> treated as "due". */
  paymentStatus?: StaffPaymentStatus;
  /** Advances given. Managed by the server (record/delete via the Staff > assignments page). */
  payments?: StaffPayment[];
}

export interface InvoiceInfo {
  totalAmount: string;
  advancePaid: string;
  dueAmount?: string;
  paymentType: string;
  /** Owner-only. What was spent on the order (flowers, drinks, food, etc.), for profit tracking. */
  investment?: string;
}

export interface LegacyItem {
  label: string;
  qty: string;
  note?: string;
}

export interface Order {
  id: string; // e.g. "ADVKM-0007"
  customer: CustomerInfo;
  serviceType: ServiceType;
  program: ProgramInfo;
  eventDate: string | null;
  status: OrderStatus;
  /** Has the physical order (tent/decoration work) been completed? */
  orderCompletionStatus?: CompletionStatus;
  /** Has the invoice been paid in full? Owner-managed only. */
  paymentCompletionStatus?: CompletionStatus;
  createdAt: string;
  tenthouse: TenthouseInfo | null;
  decoration: DecorationInfo | null;
  staffAssigned: StaffAssignment[];
  invoice: InvoiceInfo;
  legacyItems?: LegacyItem[];
  notes?: string;
  /** Items returned to the shop after the event (final check). Keyed by item string or index::string */
  returnedItems?: Record<string, boolean>;
  /** Note for item return check: missing items, damages, or items left behind to bring again */
  itemReturnNotes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address?: string;
  location?: GeoLocation | null;
  referredBy?: string;
}

export interface StaffAssignmentRecord {
  orderId: string;
  program: string;
  customerName: string;
  amount: string;
  date?: string;
  paymentStatus?: StaffPaymentStatus;
  payments?: StaffPayment[];
}

/** What an investment (business spend) was made toward. */
export type InvestmentCategory = "decoration" | "tenthouse" | "lighting" | "dj" | "food" | "flowers" | "others";

export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  "decoration",
  "tenthouse",
  "lighting",
  "dj",
  "food",
  "flowers",
  "others",
];

export interface Investment {
  id: string;
  /** Free-text description of what was invested in, e.g. "New DJ speakers". */
  name: string;
  category: InvestmentCategory;
  /** Rupees, as a string (like every other amount in the app). */
  amount: string;
  /** YYYY-MM-DD — the day the money was spent. */
  date: string;
  createdAt?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  /** 4-digit login PIN. Never returned by the API — write-only from the client. */
  pin?: string;
  /** Borrow ledger. Managed by the server; missing on older staff records. Staff logins only receive their own. */
  borrows?: StaffBorrow[];
  assignments: StaffAssignmentRecord[];
}