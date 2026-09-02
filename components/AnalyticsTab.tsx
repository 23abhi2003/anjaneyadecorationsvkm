"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, DateRangePicker } from "@heroui/react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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

  const totalRevenue = filtered.reduce((sum, o) => sum + (parseFloat(o.invoice?.totalAmount || "0") || 0), 0);
  const totalCollected = filtered.reduce((sum, o) => sum + (parseFloat(o.invoice?.advancePaid || "0") || 0), 0);
  const totalDue = Math.max(totalRevenue - totalCollected, 0);

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

      <div className="grid sm:grid-cols-3 gap-4">
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
    </div>
  );
}
