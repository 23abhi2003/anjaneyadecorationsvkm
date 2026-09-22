"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import InvoicesTab from "@/components/InvoicesTab";
import type { Order } from "@/lib/types";

export default function InvoicesPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiFetch("/api/orders")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Order[]>;
      })
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load invoices. Is the API reachable?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Invoices
      </h1>

      {!isOwner && <p className="text-center text-[#F8F4E6]/60 py-16">Invoices are only visible to owner logins.</p>}

      {isOwner && loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading invoices…" color="primary" />
        </div>
      )}

      {isOwner && !loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {isOwner && !loading && !error && <InvoicesTab orders={orders} />}
    </div>
  );
}