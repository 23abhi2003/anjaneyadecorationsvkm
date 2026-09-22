"use client";

import { useMemo } from "react";
import { Card, CardBody } from "@heroui/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { StaffMember } from "@/lib/types";
import { inr, parseAmt, staffBalance, summarizeAssignments } from "@/lib/staffPay";

/** Numeric part of an order id (ADVKM-0042 -> 42), used only to break ties between same-day orders. */
function orderSeq(orderId: string): number {
  const m = /(\d+)\s*$/.exec(orderId);
  return m ? parseInt(m[1], 10) : 0;
}

export default function StaffAnalyticsTab({ staff }: { staff?: StaffMember | null }) {
  if (!staff) {
    return <p className="text-sm text-foreground/50 py-10 text-center">Loading staff analytics…</p>;
  }

  const assignments = staff.assignments || [];
  const pay = summarizeAssignments(assignments);
  const bal = staffBalance(assignments, staff.borrows);
  const totalOrders = assignments.length;

  // Every assignment, oldest first, for the earnings-over-time area chart.
  const earningsByOrder = useMemo(() => {
    return [...assignments]
      .sort((a, b) => {
        const da = a.date ? Date.parse(a.date) : NaN;
        const db = b.date ? Date.parse(b.date) : NaN;
        const aValid = Number.isFinite(da);
        const bValid = Number.isFinite(db);
        if (!aValid && !bValid) return orderSeq(a.orderId) - orderSeq(b.orderId);
        if (!aValid) return 1;
        if (!bValid) return -1;
        if (da !== db) return da - db;
        return orderSeq(a.orderId) - orderSeq(b.orderId);
      })
      .map((a) => ({
        name: a.orderId.replace(/^ADVKM-/, "#"),
        program: a.program || "",
        customer: a.customerName || "",
        amount: parseAmt(a.amount),
      }));
  }, [assignments]);

  const moneyBars = [
    { name: "Total earned", value: pay.total },
    { name: "Borrowed", value: bal.borrowed },
    { name: "Remaining", value: bal.remaining },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total orders
          </p>
          <p className="text-2xl text-foreground mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {totalOrders.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total amount
          </p>
          <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {inr(pay.total)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Borrowed
          </p>
          <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {inr(bal.borrowed)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Remaining
          </p>
          <p className={`text-2xl mt-1 ${bal.remaining < 0 ? "text-danger" : "text-success"}`} style={{ fontFamily: "var(--font-display)" }}>
            {inr(bal.remaining)}
          </p>
        </div>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Earnings over time
          </h3>
          {earningsByOrder.length === 0 ? (
            <p className="text-sm text-foreground/50 py-10 text-center">No assignments yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={earningsByOrder} margin={{ left: 4, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="staffEarnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D9A427" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#D9A427" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Amount"]}
                  labelFormatter={(label: string, payload) => {
                    const row = payload?.[0]?.payload as { program: string; customer: string } | undefined;
                    const bits = [row?.program, row?.customer].filter(Boolean).join(" · ");
                    return bits ? `${label} — ${bits}` : label;
                  }}
                />
                <Area type="monotone" dataKey="amount" name="amount" stroke="#D9A427" fill="url(#staffEarnFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Total vs borrowed vs remaining
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={moneyBars} margin={{ left: 4, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="staffMoneyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D9A427" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#D9A427" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Area
                type="monotone"
                dataKey="value"
                name="Amount"
                stroke="#D9A427"
                fill="url(#staffMoneyFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
          {bal.remaining < 0 && (
            <p className="text-xs text-danger text-center mt-2">
              Borrowed {inr(-bal.remaining)} more than the orders total so far.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}