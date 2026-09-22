"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, DateRangePicker, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Order, StaffMember } from "@/lib/types";
import { staffBalance, summarizeAssignments, inr } from "@/lib/staffPay";

const PIE_COLORS = ["#D9A427", "#5B2674", "#3F6B1F", "#8B4A15", "#6E1F3A"];

function toDate(d?: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinRange(dateStr: string | null | undefined, range: RangeValue<DateValue> | null): boolean {
  if (!range) return true;
  const d = toDate(dateStr);
  if (!d) return false;
  const start = range.start.toDate(getLocalTimeZone());
  const end = range.end.toDate(getLocalTimeZone());
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

/** Picks the date an order should be plotted against: event date, falling back to creation date. */
function orderDate(o: Order): string | null {
  return o.eventDate || o.createdAt || null;
}

export default function AnalyticsTab({ orders, staff }: { orders: Order[]; staff: StaffMember[] }) {
  const [range, setRange] = useState<RangeValue<DateValue> | null>(null);

  const filtered = useMemo(() => orders.filter((o) => withinRange(orderDate(o), range)), [orders, range]);

  const revenueByMonth = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; collected: number }>();
    filtered.forEach((o) => {
      const d = toDate(orderDate(o));
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const entry = map.get(key) || { month: label, revenue: 0, collected: 0 };
      entry.revenue += parseFloat(o.invoice?.totalAmount || "0") || 0;
      entry.collected += parseFloat(o.invoice?.advancePaid || "0") || 0;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([, v]) => v);
  }, [filtered]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, confirmed: 0, completed: 0 };
    filtered.forEach((o) => {
      counts[o.status || "pending"] = (counts[o.status || "pending"] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const staffIncome = useMemo(() => {
    const orderIdsInRange = new Set(filtered.map((o) => o.id));
    return staff
      .map((s) => {
        const total = (s.assignments || [])
          .filter((a) => orderIdsInRange.has(a.orderId))
          .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
        return { name: s.name, total };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [staff, filtered]);

  /** Order label used on the profit chart's X-axis: short id + customer name. */
  function orderLabel(o: Order): string {
    return o.id.replace(/^ADVKM-/, "#");
  }

  const profitByOrder = useMemo(() => {
    return filtered
      .map((o) => {
        const orderAmount = parseFloat(o.invoice?.totalAmount || "0") || 0;
        const staffAmount = (o.staffAssigned || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
        const investment = parseFloat(o.invoice?.investment || "0") || 0;
        const profit = orderAmount - staffAmount - investment;
        return {
          name: orderLabel(o),
          customer: o.customer?.name?.trim() || "",
          orderAmount,
          staffAmount,
          investment,
          profit,
          date: orderDate(o),
        };
      })
      .filter((r) => r.orderAmount > 0)
      .sort((a, b) => {
        const da = toDate(a.date)?.getTime() ?? 0;
        const db = toDate(b.date)?.getTime() ?? 0;
        return da - db;
      });
  }, [filtered]);

  const totalProfit = profitByOrder.reduce((sum, r) => sum + r.profit, 0);

  const profitSplit = useMemo(() => {
    const totalStaff = profitByOrder.reduce((sum, r) => sum + r.staffAmount, 0);
    const totalInvestment = profitByOrder.reduce((sum, r) => sum + r.investment, 0);
    return [
      { name: "Staff", value: totalStaff },
      { name: "Investment", value: totalInvestment },
      { name: "Profit", value: Math.max(totalProfit, 0) },
    ].filter((r) => r.value > 0);
  }, [profitByOrder, totalProfit]);

  const SPLIT_COLORS: Record<string, string> = { Staff: "#8B4A15", Investment: "#D9A427", Profit: "#3F6B1F" };

  const totalRevenue = filtered.reduce((sum, o) => sum + (parseFloat(o.invoice?.totalAmount || "0") || 0), 0);
  const totalCollected = filtered.reduce((sum, o) => sum + (parseFloat(o.invoice?.advancePaid || "0") || 0), 0);
  const totalDue = Math.max(totalRevenue - totalCollected, 0);
  const totalOrderCount = filtered.length;

  /** Per-staff money overview: orders assigned, total earned, borrowed, and what's left after
   * borrows. Always all-time (not date-filtered), matching the Staff page and borrows panel. */
  const staffOverview = useMemo(() => {
    return staff
      .map((s) => {
        const pay = summarizeAssignments(s.assignments || []);
        const bal = staffBalance(s.assignments, s.borrows);
        return {
          id: s.id,
          name: s.name,
          orders: (s.assignments || []).length,
          total: pay.total,
          borrowed: bal.borrowed,
          remaining: bal.remaining,
        };
      })
      .filter((s) => s.orders > 0 || s.borrowed > 0)
      .sort((a, b) => b.total - a.total);
  }, [staff]);

  return (
    <div className="space-y-6">
      <div className="bg-content1 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <DateRangePicker
          label="Filter by event/order date range"
          variant="bordered"
          value={range}
          onChange={setRange}
          maxValue={today(getLocalTimeZone())}
          className="max-w-xs"
        />
        {range && (
          <button type="button" onClick={() => setRange(null)} className="text-xs text-secondary hover:underline pb-2.5">
            Clear filter
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total orders
          </p>
          <p className="text-2xl text-foreground mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {totalOrderCount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total invoiced
          </p>
          <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Collected
          </p>
          <p className="text-2xl text-success mt-1" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Outstanding
          </p>
          <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totalDue.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Revenue over time
          </h3>
          {revenueByMonth.length === 0 ? (
            <p className="text-sm text-foreground/50 py-10 text-center">No invoiced orders in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Invoiced" stroke="#D9A427" strokeWidth={2} />
                <Line type="monotone" dataKey="collected" name="Collected" stroke="#3F6B1F" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-content1">
          <CardBody className="p-5">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Orders by status
            </h3>
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-foreground/50 py-10 text-center">No orders in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody className="p-5">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Staff-wise income
            </h3>
            {staffIncome.length === 0 ? (
              <p className="text-sm text-foreground/50 py-10 text-center">No staff payouts in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={staffIncome} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Bar dataKey="total" name="Income" fill="#5B2674" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-content1 lg:col-span-2">
          <CardBody className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Profit by order
              </h3>
              <span className="text-sm text-foreground/60" style={{ fontFamily: "var(--font-mono)" }}>
                Total profit: <span className={totalProfit < 0 ? "text-danger" : "text-success"}>₹{totalProfit.toLocaleString("en-IN")}</span>
              </span>
            </div>
            {profitByOrder.length === 0 ? (
              <p className="text-sm text-foreground/50 py-10 text-center">No invoiced orders in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={profitByOrder} margin={{ left: 4, right: 12, top: 8 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3F6B1F" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#3F6B1F" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="staffFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B4A15" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#8B4A15" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="investmentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D9A427" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#D9A427" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, key: string) => [
                      `₹${value.toLocaleString("en-IN")}`,
                      key === "staffAmount" ? "Staff" : key === "investment" ? "Investment" : key === "profit" ? "Profit" : key,
                    ]}
                    labelFormatter={(label: string, payload) => {
                      const row = payload?.[0]?.payload as { customer: string; orderAmount: number } | undefined;
                      return row ? `${label}${row.customer ? " · " + row.customer : ""} — Order ₹${row.orderAmount.toLocaleString("en-IN")}` : label;
                    }}
                  />
                  <Legend
                    formatter={(v: string) => (v === "staffAmount" ? "Staff" : v === "investment" ? "Investment (flowers/drinks/food)" : "Profit")}
                  />
                  <Area type="monotone" dataKey="staffAmount" name="staffAmount" stackId="1" stroke="#8B4A15" fill="url(#staffFill)" />
                  <Area type="monotone" dataKey="investment" name="investment" stackId="1" stroke="#D9A427" fill="url(#investmentFill)" />
                  <Area type="monotone" dataKey="profit" name="profit" stackId="1" stroke="#3F6B1F" fill="url(#profitFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody className="p-5">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Staff vs investment vs profit
            </h3>
            {profitSplit.length === 0 ? (
              <p className="text-sm text-foreground/50 py-10 text-center">No invoiced orders in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={profitSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {profitSplit.map((entry) => (
                      <Cell key={entry.name} fill={SPLIT_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <div className="mb-1">
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Staff overview
            </h3>
            <p className="text-xs text-foreground/50">
              All-time per staff member — orders assigned, total earned, borrowed, and what&apos;s left after borrows
              (not affected by the date filter above).
            </p>
          </div>
          {staffOverview.length === 0 ? (
            <p className="text-sm text-foreground/50 py-10 text-center">No staff activity yet.</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <Table removeWrapper aria-label="Staff overview" className="min-w-[560px]">
                <TableHeader>
                  <TableColumn>STAFF</TableColumn>
                  <TableColumn>ORDERS</TableColumn>
                  <TableColumn>TOTAL AMOUNT</TableColumn>
                  <TableColumn>BORROWED</TableColumn>
                  <TableColumn>REMAINING</TableColumn>
                </TableHeader>
                <TableBody>
                  {staffOverview.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{s.name}</TableCell>
                      <TableCell>{s.orders}</TableCell>
                      <TableCell className="text-secondary font-semibold">{inr(s.total)}</TableCell>
                      <TableCell className="text-warning font-semibold">{inr(s.borrowed)}</TableCell>
                      <TableCell className={`font-semibold ${s.remaining < 0 ? "text-danger" : "text-success"}`}>
                        {inr(s.remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}