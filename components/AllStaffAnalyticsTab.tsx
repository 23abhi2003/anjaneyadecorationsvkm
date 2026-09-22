"use client";

import { useMemo } from "react";
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { StaffMember } from "@/lib/types";
import { inr, staffBalance, summarizeAssignments } from "@/lib/staffPay";

/** Every staff member's money, side by side, for the combined chart and table below. */
function buildOverview(staff: StaffMember[]) {
  return staff
    .map((s) => {
      const pay = summarizeAssignments(s.assignments || []);
      const bal = staffBalance(s.assignments, s.borrows);
      return {
        id: s.id,
        name: s.name,
        orders: (s.assignments || []).length,
        total: pay.total,
        due: pay.due,
        borrowed: bal.borrowed,
        remaining: bal.remaining,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export default function AllStaffAnalyticsTab({ staff }: { staff?: StaffMember[] | null }) {
  const overview = useMemo(() => buildOverview(staff || []), [staff]);
  const active = overview.filter((s) => s.orders > 0 || s.borrowed > 0);

  const totals = overview.reduce(
    (acc, s) => ({
      orders: acc.orders + s.orders,
      total: acc.total + s.total,
      borrowed: acc.borrowed + s.borrowed,
      remaining: acc.remaining + s.remaining,
    }),
    { orders: 0, total: 0, borrowed: 0, remaining: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Staff members
          </p>
          <p className="text-2xl text-foreground mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {(staff || []).length.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total earned (all staff)
          </p>
          <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {inr(totals.total)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total borrowed
          </p>
          <p className="text-2xl text-warning mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {inr(totals.borrowed)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total remaining
          </p>
          <p className={`text-2xl mt-1 ${totals.remaining < 0 ? "text-danger" : "text-success"}`} style={{ fontFamily: "var(--font-display)" }}>
            {inr(totals.remaining)}
          </p>
        </div>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            All staff — earned vs borrowed vs remaining
          </h3>
          <p className="text-xs text-foreground/50 mb-4">One graph comparing every staff member, all-time.</p>
          {active.length === 0 ? (
            <p className="text-sm text-foreground/50 py-16 text-center">No staff activity yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={active} margin={{ left: 8, right: 16, top: 8 }}>
                <defs>
                  <linearGradient id="allStaffTotalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D9A427" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#D9A427" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="allStaffBorrowedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B4A15" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#8B4A15" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="allStaffRemainingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3F6B1F" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#3F6B1F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#24112922" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Legend
                  formatter={(v: string) => (v === "total" ? "Total earned" : v === "borrowed" ? "Borrowed" : "Remaining")}
                />
                <Area type="monotone" dataKey="total" name="total" stroke="#D9A427" fill="url(#allStaffTotalFill)" />
                <Area type="monotone" dataKey="borrowed" name="borrowed" stroke="#8B4A15" fill="url(#allStaffBorrowedFill)" />
                <Area type="monotone" dataKey="remaining" name="remaining" stroke="#3F6B1F" fill="url(#allStaffRemainingFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <Card className="bg-content1">
        <CardBody className="p-5">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Staff details
          </h3>
          {overview.length === 0 ? (
            <p className="text-sm text-foreground/50 py-10 text-center">No staff added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table removeWrapper aria-label="All staff overview" className="min-w-[640px]">
                <TableHeader>
                  <TableColumn>STAFF</TableColumn>
                  <TableColumn>ORDERS</TableColumn>
                  <TableColumn>TOTAL EARNED</TableColumn>
                  <TableColumn>DUE</TableColumn>
                  <TableColumn>BORROWED</TableColumn>
                  <TableColumn>REMAINING</TableColumn>
                </TableHeader>
                <TableBody>
                  {overview.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{s.name}</TableCell>
                      <TableCell>{s.orders}</TableCell>
                      <TableCell className="text-secondary font-semibold">{inr(s.total)}</TableCell>
                      <TableCell className={s.due > 0 ? "text-warning font-semibold" : ""}>{inr(s.due)}</TableCell>
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