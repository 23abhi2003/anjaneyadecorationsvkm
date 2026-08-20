"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Chip, Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import DashboardSearch from "@/components/DashboardSearch";
import NavCard from "@/components/NavCard";
import type { Order, Customer, StaffMember } from "@/lib/types";

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const totalCollected = orders.reduce((sum, o) => sum + (parseFloat(o.invoice?.advancePaid || "0") || 0), 0);
  const totalDue = orders.reduce((sum, o) => {
    const total = parseFloat(o.invoice?.totalAmount || "0") || 0;
    const advance = parseFloat(o.invoice?.advancePaid || "0") || 0;
    return sum + Math.max(total - advance, 0);
  }, 0);
  const pendingOrders = orders.filter((o) => o.status !== "completed").length;

  return (
    <div className="space-y-10">
      <section className="text-center py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[#D9A427]" style={{ fontFamily: "var(--font-mono)" }}>
          Anjaneya Decorations &middot; V.K.M
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-[#F8F4E6] mt-2" style={{ fontFamily: "var(--font-display)" }}>
          Every order, staff assignment, and invoice in one place.
        </h1>
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

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Collected so far
          </p>
          <p className="text-2xl text-success mt-1" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Pending dues
          </p>
          <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totalDue.toLocaleString("en-IN")}
          </p>
        </div>
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
                  <span className="text-foreground/50">— {o.program?.type || o.serviceType}</span>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Total orders
          </h2>
          <Link href="/orders" className="text-xs text-secondary hover:underline" style={{ fontFamily: "var(--font-mono)" }}>
            View all &rarr;
          </Link>
        </div>
        <div className="space-y-2">
          {orders.slice(0, 5).map((o) => (
            <Link
              key={o.id}
              href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
              className="flex items-center justify-between px-4 py-2.5 rounded-md bg-content2 hover:brightness-95 transition-all"
            >
              <span className="text-sm text-foreground">
                <span className="text-foreground/40 mr-1">{o.id}</span>
                {o.customer?.name}
              </span>
              <span className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
                {o.serviceType} &middot; {o.status}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
