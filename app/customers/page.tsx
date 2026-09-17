"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import CustomersClient from "@/components/CustomersClient";
import { withOrderCounts, type CustomerWithCount } from "@/lib/customer";
import type { Order, Customer } from "@/lib/types";

// NOTE: this file must export nothing but the default component. App Router
// page files fail `next build`'s type check if they export helper functions.
// The customer/order matching helpers live in `lib/customers.ts`.

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