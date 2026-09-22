"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Card, CardBody, Button } from "@heroui/react";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

function invoiceMoney(o: Order) {
  const total = parseFloat(o.invoice?.totalAmount || "0") || 0;
  const advance = parseFloat(o.invoice?.advancePaid || "0") || 0;
  const due = Math.max(total - advance, 0);
  return { total, advance, due };
}

export default function InvoicesTab({ orders }: { orders: Order[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const rows = [...orders].sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
          {rows.length} {rows.length === 1 ? "invoice" : "invoices"}
        </p>
        <div className="flex items-center gap-1 bg-content2 rounded-md p-1">
          <Button
            isIconOnly
            size="sm"
            radius="sm"
            variant={view === "list" ? "solid" : "light"}
            color={view === "list" ? "primary" : "default"}
            onPress={() => setView("list")}
            aria-label="List view"
            title="List view"
          >
            <ListIcon size={16} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            radius="sm"
            variant={view === "grid" ? "solid" : "light"}
            color={view === "grid" ? "primary" : "default"}
            onPress={() => setView("grid")}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
          <Table removeWrapper aria-label="Invoices" className="min-w-[720px]">
            <TableHeader>
              <TableColumn>ORDER</TableColumn>
              <TableColumn>CUSTOMER</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>TOTAL</TableColumn>
              <TableColumn>ADVANCE</TableColumn>
              <TableColumn>DUE</TableColumn>
              <TableColumn>PAYMENT</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No orders yet.">
              {rows.map((o) => {
                const { total, advance, due } = invoiceMoney(o);
                return (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/orders/detail?id=${encodeURIComponent(o.id)}`} className="text-secondary hover:underline">
                        {o.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{o.customer?.name}</TableCell>
                    <TableCell>{o.eventDate || "—"}</TableCell>
                    <TableCell>₹{total.toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{advance.toLocaleString("en-IN")}</TableCell>
                    <TableCell className={due > 0 ? "text-warning font-semibold" : ""}>₹{due.toLocaleString("en-IN")}</TableCell>
                    <TableCell>{o.invoice?.paymentType || "—"}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={statusColor[o.status] || "warning"} className="uppercase text-[10px]">
                        {o.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-content1 rounded-lg py-16 text-center text-sm text-foreground/50">No orders yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((o) => {
            const { total, advance, due } = invoiceMoney(o);
            return (
              <Card key={o.id} className="bg-content1 border border-divider">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
                      className="text-secondary font-semibold hover:underline"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {o.id}
                    </Link>
                    <Chip size="sm" variant="flat" color={statusColor[o.status] || "warning"} className="uppercase text-[10px]">
                      {o.status}
                    </Chip>
                  </div>

                  <div>
                    <p className="font-medium truncate">{o.customer?.name || "—"}</p>
                    <p className="text-xs text-foreground/50">{o.eventDate || "No date set"}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-divider/60">
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Total
                      </p>
                      <p className="text-sm font-semibold">₹{total.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Advance
                      </p>
                      <p className="text-sm font-semibold">₹{advance.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Due
                      </p>
                      <p className={`text-sm font-semibold ${due > 0 ? "text-warning" : ""}`}>₹{due.toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/50">Payment: {o.invoice?.paymentType || "—"}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}