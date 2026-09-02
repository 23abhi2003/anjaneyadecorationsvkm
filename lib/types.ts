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
  ceiling: QtyMap;
  sidewalls: string;
  ceilingPoles: QtyMap;
  flowers: QtyMap;
}

export interface StaffAssignment {
  staffId: string;
  name: string;
  amount: string;
}

export interface InvoiceInfo {
  totalAmount: string;
  advancePaid: string;
  dueAmount?: string;
  paymentType: string;
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
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address?: string;
  location?: GeoLocation | null;
}

export interface StaffAssignmentRecord {
  orderId: string;
  program: string;
  customerName: string;
  amount: string;
  date?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  /** 4-digit login PIN. Never returned by the API — write-only from the client. */
  pin?: string;
  assignments: StaffAssignmentRecord[];
}