"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlusCircle, Phone, MessageCircle } from "lucide-react";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { DashboardSkeleton } from "@/components/Skeletons";
import { apiFetch } from "@/lib/api";
import DashboardSearch from "@/components/DashboardSearch";
import NavCard from "@/components/NavCard";
import { useAuth } from "@/lib/Auth";
import type { Order, Customer, StaffMember, Investment } from "@/lib/types";

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

function orderTotal(o: Order): number {
  return parseFloat(o.invoice?.totalAmount || "0") || 0;
}

function orderAdvance(o: Order): number {
  return parseFloat(o.invoice?.advancePaid || "0") || 0;
}

/** A fully completed order (work done + payment done) is never treated as having a due —
 * regardless of what the raw total/advance numbers say. Mirrors InvoicesTab's invoiceMoney(). */
function orderDue(o: Order): number {
  if (o.status === "completed") return 0;
  return Math.max(orderTotal(o) - orderAdvance(o), 0);
}

/** Money a single order owes staff (sum of every staff member assigned to it). */
function orderStaffAmount(o: Order): number {
  return (o.staffAssigned || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
}

function orderInvestment(o: Order): number {
  return parseFloat(o.invoice?.investment || "0") || 0;
}

function orderProfit(o: Order): number {
  return orderTotal(o) - orderStaffAmount(o) - orderInvestment(o);
}

/** Which dashboard card is currently driving the "Total orders" list below. */
type DashboardFilter = "amount" | "dues" | "staff" | "invested" | "profit" | null;

export default function HomePage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Clicking a financial-overview card filters + sorts the "Total orders"
  // list below to just those orders, instead of navigating away.
  const [filter, setFilter] = useState<DashboardFilter>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError("");
      try {
        const [ordersRes, customersRes, staffRes, investmentsRes] = await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/customers"),
          apiFetch("/api/staff"),
          // Investments are owner-only on the backend — a staff login gets a 403 here,
          // which (being inside the same Promise.all) used to sink the whole dashboard
          // load. Only fetch it for owners; staff just see 0 invested below.
          isOwner ? apiFetch("/api/investments") : Promise.resolve(null),
        ]);
        if (!ordersRes.ok || !customersRes.ok || !staffRes.ok || (investmentsRes && !investmentsRes.ok)) {
          throw new Error("failed");
        }
        const [ordersData, customersData, staffData, investmentsData] = await Promise.all([
          ordersRes.json() as Promise<Order[]>,
          customersRes.json() as Promise<Customer[]>,
          staffRes.json() as Promise<StaffMember[]>,
          investmentsRes ? (investmentsRes.json() as Promise<Investment[]>) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setOrders(ordersData);
        setCustomers(customersData);
        setStaff(staffData);
        setInvestments(investmentsData);
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
  }, [isOwner]);

  // All business-wide investments (from the Investments page) — not tied to any single
  // order, so they sit outside the per-order reduce below but still come out of profit.
  const totalBusinessInvestment = useMemo(
    () => investments.reduce((sum, i) => sum + (parseFloat(i.amount || "0") || 0), 0),
    [investments]
  );

  const customerPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      if (c.phone) {
        if (c.id) map.set(c.id, c.phone);
        if (c.name) map.set(c.name.trim().toLowerCase(), c.phone);
      }
    }
    return map;
  }, [customers]);

  function getOrderPhone(o: Order): string {
    const direct = o.customer?.phone?.trim();
    if (direct) return direct;
    const name = o.customer?.name?.trim().toLowerCase();
    if (name && customerPhoneMap.has(name)) {
      return customerPhoneMap.get(name)!;
    }
    return "";
  }

  // Owner-facing totals across ALL orders — same calculation as the Invoices
  // tab's summary row (total, dues, staff pay, invested, profit).
  const totals = useMemo(() => {
    const base = orders.reduce(
      (acc, o) => {
        acc.amount += orderTotal(o);
        acc.dues += orderDue(o);
        acc.staff += orderStaffAmount(o);
        acc.invested += orderInvestment(o);
        acc.profit += orderProfit(o);
        return acc;
      },
      { amount: 0, dues: 0, staff: 0, invested: 0, profit: 0 }
    );
    // Business-wide investments (decoration, tenthouse, lighting, etc. logged on the
    // Investments page) also come out of profit, on top of any per-order investment above.
    return { ...base, profit: base.profit - totalBusinessInvestment };
  }, [orders, totalBusinessInvestment]);

  const duesOrders = useMemo(() => orders.filter((o) => orderDue(o) > 0), [orders]);
  const investedOrders = useMemo(() => orders.filter((o) => orderInvestment(o) > 0), [orders]);

  // The list the "Total orders" section actually renders: either the default
  // 5 most-recent orders, or — when a financial-overview card is active —
  // every matching order sorted by the amount that made it match (largest first).
  const displayedOrders = useMemo(() => {
    if (filter === "amount") {
      return [...orders].sort((a, b) => orderTotal(b) - orderTotal(a));
    }
    if (filter === "dues") {
      return [...duesOrders].sort((a, b) => orderDue(b) - orderDue(a));
    }
    if (filter === "staff") {
      return [...orders].sort((a, b) => orderStaffAmount(b) - orderStaffAmount(a));
    }
    if (filter === "invested") {
      return [...investedOrders].sort((a, b) => orderInvestment(b) - orderInvestment(a));
    }
    if (filter === "profit") {
      return [...orders].sort((a, b) => orderProfit(b) - orderProfit(a));
    }
    return orders.slice(0, 5);
  }, [filter, orders, duesOrders, investedOrders]);

  if (loading) {
    return <DashboardSkeleton isAutoRides={false} />;
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

  // Of the orders coming up in the next 3 days, how many still need to be done
  // (work not marked completed yet).
  const upcomingToDo = upcoming.filter((o) => o.status !== "completed").length;

  function toggleFilter(next: Exclude<DashboardFilter, null>): void {
    setFilter((cur) => (cur === next ? null : next));
  }

  const totalOrdersTitle =
    filter === "amount"
      ? "Total amount"
      : filter === "dues"
        ? "Total dues"
        : filter === "staff"
          ? "Total staff pay"
          : filter === "invested"
            ? "Invested amount"
            : filter === "profit"
              ? "Total profit"
              : "Total orders";

  return (
    <div className="space-y-10">
      <section className="text-center py-6 flex flex-col items-center">
        {/* Logo on top of title - Same square format as shown in image */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl sm:rounded-3xl overflow-hidden border-3 border-[#D9A427] shadow-2xl bg-[#241129] mb-4 shrink-0">
          <Image
            src="/logo-new.png"
            alt="Anjaneya Decorations Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <h1
          className="text-3xl sm:text-5xl font-bold tracking-normal text-[#D9A427]"
          style={{ fontFamily: "'Philosopher', var(--font-display), Georgia, serif" }}
        >
          Anjaneya Decorations
        </h1>
        <p
          className="text-xs uppercase tracking-[0.3em] text-[#D9A427]/80 mt-1 font-semibold"
          style={{ fontFamily: "'Philosopher', var(--font-mono), sans-serif" }}
        >
          Tent House · V.K.M
        </p>

        {/* Global Search Bar */}
        <div className="w-full max-w-xl mx-auto mt-6 px-4">
          <DashboardSearch orders={orders} />
        </div>

        {/* Create Order Button */}
        <Button
          as={Link}
          href="/orders/new"
          color="primary"
          size="lg"
          radius="full"
          className="mt-5 font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90 px-8"
          style={{ fontFamily: "var(--font-display)" }}
          startContent={<PlusCircle size={20} />}
        >
          Create Order
        </Button>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <NavCard href="/orders" title="Orders" count={orders.length} sub="View, edit, invoice" />
        <NavCard href="/customers" title="Customers" count={customers.length} sub="New & returning" />
        <NavCard href="/staff" title="Staff" count={staff.length} sub="Assignments & pay" />
      </section>

      {isOwner && (
        <section className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("amount")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "amount" ? "ring-2 ring-secondary" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Total amount
            </p>
            <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totals.amount.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {orders.length} order{orders.length === 1 ? "" : "s"} &middot; tap to view
            </p>
          </Card>
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("dues")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "dues" ? "ring-2 ring-warning" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Total dues
            </p>
            <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totals.dues.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {duesOrders.length} order{duesOrders.length === 1 ? "" : "s"} awaiting payment &middot; tap to view
            </p>
          </Card>
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("staff")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "staff" ? "ring-2 ring-[#8B4A15]" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Total staff pay
            </p>
            <p className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", color: "#8B4A15" }}>
              ₹{totals.staff.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              Across all orders &middot; tap to view
            </p>
          </Card>
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("invested")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "invested" ? "ring-2 ring-primary" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Invested amount
            </p>
            <p className="text-2xl text-primary mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totals.invested.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {investedOrders.length} order{investedOrders.length === 1 ? "" : "s"} &middot; tap to view
            </p>
          </Card>
          <Card
            as={Link}
            href="/investments"
            isPressable
            isHoverable
            className="bg-content1 p-5 text-left shadow-lg transition-all"
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Business investments
            </p>
            <p className="text-2xl mt-1 text-secondary" style={{ fontFamily: "var(--font-display)" }}>
              ₹{totalBusinessInvestment.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              {investments.length} {investments.length === 1 ? "entry" : "entries"} &middot; view Investments
            </p>
          </Card>
          <Card
            isPressable
            isHoverable
            onPress={() => toggleFilter("profit")}
            className={`bg-content1 p-5 text-left shadow-lg transition-all ${
              filter === "profit" ? "ring-2 ring-success" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
              Total profit
            </p>
            <p className={`text-2xl mt-1 ${totals.profit < 0 ? "text-danger" : "text-success"}`} style={{ fontFamily: "var(--font-display)" }}>
              ₹{totals.profit.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/40 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
              Total &minus; staff &minus; invested &minus; business &middot; tap to view
            </p>
          </Card>
        </section>
      )}

      <section className="bg-content1 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Orders within 3 days
          </h2>
          <div className="flex items-center gap-2">
            <Chip color="secondary" variant="flat" size="sm">
              {upcoming.length} due soon
            </Chip>
            {upcomingToDo > 0 && (
              <Chip color="warning" variant="flat" size="sm">
                {upcomingToDo} to be done
              </Chip>
            )}
          </div>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground/60">Nothing due in the next 3 days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((o) => {
              const phone = getOrderPhone(o);
              const cleanPhone = phone.replace(/\D/g, "");
              return (
                <Link
                  key={o.id}
                  href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-md bg-content2 hover:brightness-95 transition-all gap-3"
                >
                  <span className="text-sm text-foreground truncate flex-1">
                    <span className="text-foreground/40 mr-1">{o.id}</span>
                    <strong>{o.customer?.name}</strong>{" "}
                    <span className="text-foreground/50">— {programLabel(o)}</span>
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-secondary" style={{ fontFamily: "var(--font-mono)" }}>
                      {o.eventDate}
                    </span>
                    {cleanPhone && (
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <Button
                          as="a"
                          href={`tel:${cleanPhone}`}
                          size="sm"
                          isIconOnly
                          variant="flat"
                          color="primary"
                          radius="full"
                          aria-label={`Call ${o.customer?.name || "customer"}`}
                          title={`Call ${phone}`}
                          className="w-7 h-7 min-w-7"
                        >
                          <Phone size={13} />
                        </Button>
                        <Button
                          as="a"
                          href={`https://wa.me/91${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          isIconOnly
                          variant="flat"
                          color="success"
                          radius="full"
                          aria-label={`WhatsApp ${o.customer?.name || "customer"}`}
                          title={`WhatsApp ${phone}`}
                          className="w-7 h-7 min-w-7"
                        >
                          <MessageCircle size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
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
          {displayedOrders.map((o) => {
            const phone = getOrderPhone(o);
            const cleanPhone = phone.replace(/\D/g, "");
            return (
              <Link
                key={o.id}
                href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-md bg-content2 hover:brightness-95 transition-all gap-3"
              >
                <span className="text-sm text-foreground truncate flex-1">
                  <span className="text-foreground/40 mr-1">{o.id}</span>
                  {o.customer?.name}
                </span>
                <div className="flex items-center gap-2.5 shrink-0">
                  {filter === "amount" ? (
                    <span className="text-xs text-secondary" style={{ fontFamily: "var(--font-mono)" }}>
                      ₹{orderTotal(o).toLocaleString("en-IN")} total
                    </span>
                  ) : filter === "dues" ? (
                    <span className="text-xs text-warning" style={{ fontFamily: "var(--font-mono)" }}>
                      ₹{orderDue(o).toLocaleString("en-IN")} due
                    </span>
                  ) : filter === "staff" ? (
                    <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "#8B4A15" }}>
                      ₹{orderStaffAmount(o).toLocaleString("en-IN")} staff
                    </span>
                  ) : filter === "invested" ? (
                    <span className="text-xs text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                      ₹{orderInvestment(o).toLocaleString("en-IN")} invested
                    </span>
                  ) : filter === "profit" ? (
                    <span
                      className={`text-xs ${orderProfit(o) < 0 ? "text-danger" : "text-success"}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      ₹{orderProfit(o).toLocaleString("en-IN")} profit
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
                      {o.serviceType} &middot; {o.status}
                    </span>
                  )}
                  {cleanPhone && (
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Button
                        as="a"
                        href={`tel:${cleanPhone}`}
                        size="sm"
                        isIconOnly
                        variant="flat"
                        color="primary"
                        radius="full"
                        aria-label={`Call ${o.customer?.name || "customer"}`}
                        title={`Call ${phone}`}
                        className="w-7 h-7 min-w-7"
                      >
                        <Phone size={13} />
                      </Button>
                      <Button
                        as="a"
                        href={`https://wa.me/91${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        isIconOnly
                        variant="flat"
                        color="success"
                        radius="full"
                        aria-label={`WhatsApp ${o.customer?.name || "customer"}`}
                        title={`WhatsApp ${phone}`}
                        className="w-7 h-7 min-w-7"
                      >
                        <MessageCircle size={13} />
                      </Button>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          {displayedOrders.length === 0 && (
            <p className="text-sm text-foreground/60 py-4 text-center">
              {filter === "dues"
                ? "No pending dues right now."
                : filter === "invested"
                  ? "No invested amount recorded yet."
                  : "No orders yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}