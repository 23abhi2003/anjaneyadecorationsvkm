"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
        if (!cancelled) setError("Could not load orders. Is the API reachable?");
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
          Orders
        </h1>
        <Button as={Link} href="/orders/new" color="primary" radius="sm" className="font-semibold">
          + Create Order
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading orders…" color="primary" />
        </div>
      )}

      {!loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {!loading && !error && (
        <div className="grid sm:grid-cols-2 gap-4">
          {orders.map((o) => (
            <Card
              key={o.id}
              as={Link}
              href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
              isPressable
              isHoverable
              className="bg-content1"
            >
              <CardBody className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Chip size="sm" variant="flat" color={statusColor[o.status] || "warning"} className="uppercase text-[10px]">
                        {o.status}
                      </Chip>
                      <span className="text-[11px] text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        {o.id}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mt-1.5" style={{ fontFamily: "var(--font-display)" }}>
                      {o.customer?.name}
                    </h3>
                    <p className="text-sm text-foreground/60">{o.program?.type || o.serviceType}</p>
                  </div>
                  <span className="text-xs text-foreground/50 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                    {o.eventDate || "no date"}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {!loading && !error && orders.length === 0 && <p className="text-[#F8F4E6]/60 text-center py-10">No orders yet.</p>}
    </div>
  );
}
