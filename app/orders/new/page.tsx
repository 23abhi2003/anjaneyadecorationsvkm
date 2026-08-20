"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import OrderWizard from "@/components/OrderWizard";
import type { StaffMember } from "@/lib/types";

export default function NewOrderPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/staff")
      .then((res) => (res.ok ? (res.json() as Promise<StaffMember[]>) : Promise.resolve([])))
      .then((data) => {
        if (!cancelled) setStaff(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-[#D9A427] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
        New entry
      </p>
      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Create an order
      </h1>
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading…" color="primary" />
        </div>
      ) : (
        <OrderWizard staffList={staff} />
      )}
    </div>
  );
}
