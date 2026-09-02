"use client";

import Link from "next/link";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip } from "@heroui/react";
import type { Order, OrderStatus } from "@/lib/types";

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

export default function InvoicesTab({ orders }: { orders: Order[] }) {
  const rows = [...orders].sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));

  return (
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
            const total = parseFloat(o.invoice?.totalAmount || "0") || 0;
            const advance = parseFloat(o.invoice?.advancePaid || "0") || 0;
            const due = Math.max(total - advance, 0);
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
  );
}
