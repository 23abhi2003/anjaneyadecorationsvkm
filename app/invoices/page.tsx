"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import InvoicesTab from "@/components/InvoicesTab";
import BackButton from "@/components/BackButton";
import type { Investment, Order } from "@/lib/types";

export default function InvoicesPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<Order[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch("/api/orders").then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Order[]>;
      }),
      apiFetch("/api/investments").then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Investment[]>;
      }),
    ])
      .then(([ordersData, investmentsData]) => {
        if (!cancelled) {
          setOrders(ordersData);
          setInvestments(investmentsData);
        }
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
      <div className="mb-4">
        <BackButton href="/" label="Back to Dashboard" />
      </div>

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

      {isOwner && !loading && !error && <InvoicesTab orders={orders} investments={investments} />}

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href="/" label="Back to Dashboard" />
      </div>
    </div>
  );
}