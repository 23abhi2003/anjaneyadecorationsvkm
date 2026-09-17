"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import CustomersClient from "@/components/CustomersClient";
import type { Order, Customer, CustomerInfo } from "@/lib/types";

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [customersRes, ordersRes] = await Promise.all([apiFetch("/api/customers"), apiFetch("/api/orders")]);
      if (!customersRes.ok || !ordersRes.ok) throw new Error("failed");
      const [customersData, ordersData] = await Promise.all([
        customersRes.json() as Promise<Customer[]>,
        ordersRes.json() as Promise<Order[]>,
      ]);
      setCustomers(withOrderCounts(customersData, ordersData));
    } catch {
      setError("Could not load customers. Is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading customers…" color="primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-danger py-24">{error}</p>;
  }

  return <CustomersClient customers={customers} onAdded={load} />;
}