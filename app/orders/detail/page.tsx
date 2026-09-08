"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Spinner, Button } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import OrderDetailClient from "@/components/OrderDetailClient";
import type { Order, StaffMember } from "@/lib/types";

function OrderDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [order, setOrder] = useState<Order | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Order.staffAssigned only stores {staffId, name, amount} — no phone. Pull the
  // full staff list once so the "send to staff" WhatsApp buttons know which
  // number to open. Failure here is non-fatal; the order still renders, it
  // just won't be able to show a phone-based send button for any staff member.
  useEffect(() => {
    apiFetch("/api/staff")
      .then((res) => (res.ok ? (res.json() as Promise<StaffMember[]>) : []))
      .then((data) => setStaffList(data))
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiFetch(`/api/orders/${encodeURIComponent(id)}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Order>;
      })
      .then((data) => {
        if (!cancelled && data) setOrder(data);
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

  return <OrderDetailClient order={order} staffList={staffList} />;
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading order…" color="primary" />
        </div>
      }
    >
      <OrderDetailInner />
    </Suspense>
  );
}
