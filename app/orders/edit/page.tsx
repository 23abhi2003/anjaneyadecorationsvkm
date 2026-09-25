"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Spinner, Button } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import OrderWizard from "@/components/OrderWizard";
import BackButton from "@/components/BackButton";
import type { Order, StaffMember } from "@/lib/types";

function EditOrderInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [order, setOrder] = useState<Order | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      apiFetch(`/api/orders/${encodeURIComponent(id)}`).then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Order>;
      }),
      apiFetch("/api/staff")
        .then((res) => (res.ok ? (res.json() as Promise<StaffMember[]>) : Promise.resolve([])))
        .catch(() => [] as StaffMember[]),
    ])
      .then(([orderData, staffData]) => {
        if (cancelled) return;
        if (!orderData) {
          setNotFound(true);
          return;
        }
        setOrder(orderData);
        setStaff(staffData);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading order…" color="primary" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">Order not found.</p>
        <Button as={Link} href="/orders" color="primary" radius="sm">
          Back to orders
        </Button>
      </div>
    );
  }

  return (
    <div>
      <BackButton href={id ? `/orders/detail?id=${encodeURIComponent(id)}` : "/orders"} label="Back to Order" />
      <p className="text-xs uppercase tracking-[0.25em] text-[#D9A427] mb-2 mt-4" style={{ fontFamily: "var(--font-mono)" }}>
        {order.id}
      </p>
      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Edit order
      </h1>
      <OrderWizard staffList={staff} initialOrder={order} />
      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href={id ? `/orders/detail?id=${encodeURIComponent(id)}` : "/orders"} label="Back to Order" />
      </div>
    </div>
  );
}

export default function EditOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading order…" color="primary" />
        </div>
      }
    >
      <EditOrderInner />
    </Suspense>
  );
}