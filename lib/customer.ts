import type { Customer, CustomerInfo, Order } from "@/lib/types";

/**
 * Shared customer helpers.
 *
 * These live here rather than in `app/customers/page.tsx` on purpose: a
 * Next.js App Router page file is only allowed to export `default` plus a
 * fixed set of route config exports (`metadata`, `revalidate`, …). Exporting
 * a plain helper function from a page fails the production type check with
 * "Property 'x' is incompatible with index signature ... not assignable to
 * type 'never'". Types are erased at build time so they'd be fine, but the
 * function isn't — so both the type and the functions now live in lib/.
 */

export interface CustomerWithCount extends Customer {
  orderCount: number;
}

/**
 * Matches an order to a customer the same way the backend does
 * (`listOrdersForCustomer` in the API's db.ts): phone when we have one,
 * otherwise an exact, case-insensitive name match.
 *
 * Keeping this identical to the server matters for the delete flow — the
 * count shown next to the "Delete" button has to be the same count the API
 * uses when it decides whether to allow the delete.
 */
export function orderBelongsToCustomer(order: Order, customer: Pick<Customer, "name" | "phone">): boolean {
  const oc: Partial<CustomerInfo> = order.customer ?? {};
  const phone = (customer.phone || "").trim();
  const name = (customer.name || "").trim().toLowerCase();
  if (phone && oc.phone && oc.phone.trim() === phone) return true;
  if (!phone && oc.name && oc.name.trim().toLowerCase() === name) return true;
  return false;
}

export function withOrderCounts(customers: Customer[], orders: Order[]): CustomerWithCount[] {
  return customers.map((c) => ({
    ...c,
    orderCount: orders.filter((o) => orderBelongsToCustomer(o, c)).length,
  }));
}