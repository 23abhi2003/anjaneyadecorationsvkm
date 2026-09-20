import type { InvoiceInfo, OrderPayment } from "@/lib/types";
import { parseAmt } from "@/lib/staffPay";

/**
 * Customer payment maths for one order, shared by the order page, the orders list,
 * the Invoices tab, the dashboard, analytics and the PDFs so they can never disagree.
 *
 *   total      what the customer has to pay
 *   advance    what they paid up front (invoice.advancePaid, dated by invoice.advanceDate)
 *   payments   every later payment (date / mode / note)
 *   received   advance + payments
 *   due        total - received (never below 0)
 *
 * Example: total 2000, advance 500, then 500 more on a later date -> received 1000, due 1000.
 */

export interface InvoiceMoney {
  total: number;
  advance: number;
  /** Sum of the payments recorded after the advance. */
  later: number;
  /** advance + later */
  received: number;
  due: number;
  payments: OrderPayment[];
}

type InvoiceLike = Partial<Pick<InvoiceInfo, "totalAmount" | "advancePaid" | "payments">> | null | undefined;

export function invoiceMoney(invoice: InvoiceLike): InvoiceMoney {
  const total = parseAmt(invoice?.totalAmount);
  const advance = parseAmt(invoice?.advancePaid);
  const payments = invoice?.payments ?? [];
  const later = payments.reduce((sum, p) => sum + parseAmt(p.amount), 0);
  const received = advance + later;
  return { total, advance, later, received, due: Math.max(total - received, 0), payments };
}

/** "2026-09-10" -> "10 Sep 2026". Falls back to the raw text if it isn't a valid date. */
export function niceDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}