"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import AnalyticsTab from "@/components/AnalyticsTab";
import type { Order, StaffMember } from "@/lib/types";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
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
      apiFetch("/api/staff").then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<StaffMember[]>;
      }),
    ])
      .then(([ordersData, staffData]) => {
        if (cancelled) return;
        setOrders(ordersData);
        setStaff(staffData);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load analytics. Is the API reachable?");
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
        Analytics
      </h1>

      {!isOwner && <p className="text-center text-[#F8F4E6]/60 py-16">Analytics is only visible to owner logins.</p>}

      {isOwner && loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading analytics…" color="primary" />
        </div>
      )}

      {isOwner && !loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {isOwner && !loading && !error && <AnalyticsTab orders={orders} staff={staff} />}
    </div>
  );
}