"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Checkbox, Chip, Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { generateCombinedOrdersPdf } from "@/lib/pdf";
import type { Order, OrderStatus } from "@/lib/types";
import Pagination from "@/components/pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

function orderTotal(o: Order): number {
  return parseFloat(o.invoice?.totalAmount || "0") || 0;
}

function orderAdvance(o: Order): number {
  return parseFloat(o.invoice?.advancePaid || "0") || 0;
}

function orderDue(o: Order): number {
  return Math.max(orderTotal(o) - orderAdvance(o), 0);
}

function OrdersList({
  orders,
  selectable,
  selected,
  onToggle,
}: {
  orders: Order[];
  /** Shows a checkbox on each card for building a combined multi-order PDF. */
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  if (orders.length === 0) {
    return <p className="text-[#F8F4E6]/60 text-center py-10">No orders yet.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {orders.map((o) => (
        <Card key={o.id} className="bg-content1 relative">
          {selectable && (
            <div className="absolute top-3 right-3 z-10 no-print" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                isSelected={selected?.has(o.id) ?? false}
                onValueChange={() => onToggle?.(o.id)}
                aria-label={`Select order ${o.id} for combined PDF`}
              />
            </div>
          )}
          <Link href={`/orders/detail?id=${encodeURIComponent(o.id)}`} className="block">
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
                <span className="text-xs text-foreground/50 shrink-0 pr-8" style={{ fontFamily: "var(--font-mono)" }}>
                  {o.eventDate || "no date"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Chip size="sm" variant="flat" color="primary" className="text-[10px]">
                  Total ₹{orderTotal(o).toLocaleString("en-IN")}
                </Chip>
                <Chip
                  size="sm"
                  variant="flat"
                  color={orderDue(o) > 0 ? "danger" : "success"}
                  className="text-[10px]"
                >
                  {orderDue(o) > 0 ? `Remaining ₹${orderDue(o).toLocaleString("en-IN")}` : "Fully paid"}
                </Chip>
              </div>
            </CardBody>
          </Link>
        </Card>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [combining, setCombining] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = MIN_PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/orders")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Order[]>;
      })
      .then((ordersData) => {
        if (!cancelled) setOrders(ordersData);
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

  const selectedOrders = useMemo(() => orders.filter((o) => selectedIds.has(o.id)), [orders, selectedIds]);

  const currentPage = clampPage(page, orders.length, pageSize);
  const paged = useMemo(() => paginate(orders, currentPage, pageSize), [orders, currentPage, pageSize]);

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadCombined(): Promise<void> {
    if (selectedOrders.length < 2) return;
    setCombining(true);
    try {
      await generateCombinedOrdersPdf(selectedOrders, isOwner);
    } finally {
      setCombining(false);
    }
  }

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

      {!loading && !error && selectedOrders.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-content1 rounded-lg px-4 py-3 mb-4 no-print">
          <span className="text-sm text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
            {selectedOrders.length} order{selectedOrders.length > 1 ? "s" : ""} selected
            {selectedOrders.length === 1 ? " — pick at least one more for a combined PDF" : ""}
          </span>
          <Button
            size="sm"
            color="primary"
            radius="sm"
            className="font-semibold"
            isDisabled={selectedOrders.length < 2}
            isLoading={combining}
            onPress={downloadCombined}
          >
            Download combined PDF
          </Button>
          <Button size="sm" variant="light" radius="sm" onPress={() => setSelectedIds(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading orders…" color="primary" />
        </div>
      )}

      {!loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {!loading && !error && (
        <>
          <OrdersList orders={paged} selectable selected={selectedIds} onToggle={toggleSelected} />
          <div className="mt-4">
            <Pagination page={currentPage} pageSize={pageSize} total={orders.length} itemLabel="orders" onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}