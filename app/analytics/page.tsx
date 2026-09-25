"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import AnalyticsTab from "@/components/AnalyticsTab";
import StaffAnalyticsTab from "@/components/StaffAnalyticsTab";
import BackButton from "@/components/BackButton";
import type { Order, StaffMember } from "@/lib/types";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ownStaff, setOwnStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (isOwner) {
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
    } else if (user?.staffId) {
      apiFetch(`/api/staff/${encodeURIComponent(user.staffId)}`)
        .then((res) => {
          if (!res.ok) throw new Error("failed");
          return res.json() as Promise<StaffMember>;
        })
        .then((data) => {
          if (!cancelled) setOwnStaff(data);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load your analytics. Is the API reachable?");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [isOwner, user?.staffId]);

  return (
    <div>
      <div className="mb-4">
        <BackButton href="/" label="Back to Dashboard" />
      </div>

      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Analytics
      </h1>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading analytics…" color="primary" />
        </div>
      )}

      {!loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {!loading && !error && isOwner && <AnalyticsTab orders={orders} staff={staff} />}

      {!loading && !error && !isOwner && ownStaff && <StaffAnalyticsTab staff={ownStaff} />}

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href="/" label="Back to Dashboard" />
      </div>
    </div>
  );
}