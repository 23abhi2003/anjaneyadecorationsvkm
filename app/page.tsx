"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import DashboardSearch from "@/components/DashboardSearch";
import NavCard from "@/components/NavCard";
import { useAuth } from "@/lib/Auth";
import type { Order, Customer, StaffMember } from "@/lib/types";
import { invoiceMoney } from "@/lib/invoicePay";

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

/** Given an order's program, return the label to display — the typed name when the
 * program type is "Others", otherwise the program type, falling back to service type. */
function programLabel(o: Order): string {
  const program = o.program;
  if (program?.type === "Others") {
    return program.name?.trim() || o.serviceType;
  }
  return program?.type || o.serviceType;
}

/** Has the physical order (tent/decoration work) been marked done? Defaults to "pending", mirroring OrderDetailClient. */
function isOrderDone(o: Order): boolean {
  return (o.orderCompletionStatus || "pending") === "completed";
}

/** Has the invoice been paid in full? Defaults to "pending". */
function isPaymentDone(o: Order): boolean {
  return (o.paymentCompletionStatus || "pending") === "completed";
}

function orderTotal(o: Order): number {
  return parseFloat(o.invoice?.totalAmount || "0") || 0;
}

/** What's still owed: total - advance - every later payment. */
function orderDue(o: Order): number {
  return invoiceMoney(o.invoice).due;
}

/** Which dashboard card is currently driving the "Total orders" list below. */
type DashboardFilter = "collected" | "pending" | "progress" | null;

export default function HomePage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Clicking "Collected so far" or "Pending dues" filters + sorts the "Total
  // orders" list below to just those orders, instead of navigating away.
  const [filter, setFilter] = useState<DashboardFilter>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError("");
      try {
        const [ordersRes, customersRes, staffRes] = await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/customers"),
          apiFetch("/api/staff"),
        ]);
        if (!ordersRes.ok || !customersRes.ok || !staffRes.ok) throw new Error("failed");
        const [ordersData, customersData, staffData] = await Promise.all([
          ordersRes.json() as Promise<Order[]>,
          customersRes.json() as Promise<Customer[]>,
          staffRes.json() as Promise<StaffMember[]>,
        ]);
        if (cancelled) return;
        setOrders(ordersData);
        setCustomers(customersData);
        setStaff(staffData);
      } catch {
        if (!cancelled) setError("Could not load the dashboard. Is the API reachable?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fully done: order work finished AND the invoice fully paid.
  const collectedOrders = useMemo(
    () => orders.filter((o) => isOrderDone(o) && isPaymentDone(o)),
    [orders]
  );
  const totalCollected = collectedOrders.reduce((sum, o) => sum + orderTotal(o), 0);

  // Order work is done, but the invoice still has money outstanding.
  const pendingDueOrders = useMemo(
    () => orders.filter((o) => isOrderDone(o) && !isPaymentDone(o)),
    [orders]
  );
  const totalDue = pendingDueOrders.reduce((sum, o) => sum + orderDue(o), 0);

  const pendingOrders = orders.filter((o) => o.status !== "completed").length;

  // The list the "Total orders" section actually renders: either the default
  // 5 most-recent orders, or — when a money card is active — every matching
  // order sorted by the amount that made it match (largest first).
  const displayedOrders = useMemo(() => {
    if (filter === "collected") {
      return [...collectedOrders].sort((a, b) => orderTotal(b) - orderTotal(a));
    }
    if (filter === "pending") {
      return [...pendingDueOrders].sort((a, b) => orderDue(b) - orderDue(a));
    }
    return orders.slice(0, 5);
  }, [filter, collectedOrders, pendingDueOrders, orders]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading dashboard…" color="primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-danger py-24">{error}</p>;
  }

  const upcoming = orders
    .filter((o) => {
      const d = daysUntil(o.eventDate);
      return d >= 0 && d <= 3;
    })
    .sort((a, b) => new Date(a.eventDate ?? 0).getTime() - new Date(b.eventDate ?? 0).getTime());

  function toggleFilter(next: Exclude<DashboardFilter, null>): void {
    setFilter((cur) => (cur === next ? null : next));
  }

  const totalOrdersTitle = filter === "collected" ? "Collected so far" : filter === "pending" ? "Pending dues" : "Total orders";

  return (
    <div className="space-y-10">
      <section className="text-center py-6">
        <p className="text-xl uppercase tracking-[0.9em] text-[#D9A427]" style={{ fontFamily: "var(--font-mono)" }}>
          Anjaneya Decorations  V.K.M
        </p>
        <div className="max-w-xl mx-auto mt-6">
          <DashboardSearch orders={orders} />
        </div>
        <Button
          as={Link}
          href="/orders/new"
          color="primary"
          size="lg"
          radius="sm"
          className="mt-5 font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          + Create Order
        </Button>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <NavCard href="/orders" title="Orders" count={orders.length} sub="View, edit, invoice" />
        <NavCard href="/customers" title="Customers" count={customers.length} sub="New & returning" />
        <NavCard href="/staff" title="Staff" count={staff.length} sub="Assignments & pay" />
      </section>

      <section className={`grid gap-4 ${isOwner ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
        {isOwner && (
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("collected")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "collected" ? "ring-2 ring-success" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Collected so far
            </p>
            <p className="text-2xl text-success mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totalCollected.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {collectedOrders.length} order{collectedOrders.length === 1 ? "" : "s"} fully paid &middot; tap to view
            </p>
          </Card>
        )}
        {isOwner && (
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("pending")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "pending" ? "ring-2 ring-warning" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Pending dues
            </p>
            <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totalDue.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {pendingDueOrders.length} order{pendingDueOrders.length === 1 ? "" : "s"} awaiting payment &middot; tap to view
            </p>
          </Card>
        )}
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Orders in progress
          </p>
          <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {pendingOrders}
          </p>
        </div>
      </section>

      <section className="bg-content1 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Orders within 3 days
          </h2>
          <Chip color="secondary" variant="flat" size="sm">
            {upcoming.length} due soon
          </Chip>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground/60">Nothing due in the next 3 days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((o) => (
              <Link
                key={o.id}
                href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-md bg-content2 hover:brightness-95 transition-all"
              >
                <span className="text-sm text-foreground">
                  <span className="text-foreground/40 mr-1">{o.id}</span>
                  <strong>{o.customer?.name}</strong>{" "}
                  <span className="text-foreground/50">— {programLabel(o)}</span>
                </span>
                <span className="text-xs text-secondary" style={{ fontFamily: "var(--font-mono)" }}>
                  {o.eventDate}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-content1 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            {totalOrdersTitle}
          </h2>
          <div className="flex items-center gap-3">
            {filter && (
              <Button size="sm" variant="light" radius="sm" onPress={() => setFilter(null)}>
                Clear filter ✕
              </Button>
            )}
            <Link href="/orders" className="text-xs text-secondary hover:underline" style={{ fontFamily: "var(--font-mono)" }}>
              View all &rarr;
            </Link>
          </div>
        </div>
        <div className="space-y-2">
          {displayedOrders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
              className="flex items-center justify-between px-4 py-2.5 rounded-md bg-content2 hover:brightness-95 transition-all"
            >
              <span className="text-sm text-foreground">
                <span className="text-foreground/40 mr-1">{o.id}</span>
                {o.customer?.name}
              </span>
              {filter === "collected" ? (
                <span className="text-xs text-success" style={{ fontFamily: "var(--font-mono)" }}>
                  ₹{orderTotal(o).toLocaleString("en-IN")} collected
                </span>
              ) : filter === "pending" ? (
                <span className="text-xs text-warning" style={{ fontFamily: "var(--font-mono)" }}>
                  ₹{orderDue(o).toLocaleString("en-IN")} due
                </span>
              ) : (
                <span className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
                  {o.serviceType} &middot; {o.status}
                </span>
              )}
            </Link>
          ))}
          {displayedOrders.length === 0 && (
            <p className="text-sm text-foreground/60 py-4 text-center">
              {filter === "collected" ? "No fully-paid orders yet." : filter === "pending" ? "No pending dues right now." : "No orders yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}