"use client";

import { useState } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Button, Chip } from "@heroui/react";
import type { CustomerWithCount } from "@/app/customers/page";
import { apiFetch } from "@/lib/api";

export default function CustomersClient({
  customers,
  onAdded,
}: {
  customers: CustomerWithCount[];
  onAdded?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCustomer(): Promise<void> {
    if (!name.trim()) return;
    setSaving(true);
    const res = await apiFetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, type: "new" }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setPhone("");
      onAdded?.();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
        Customers
      </h1>

      <div className="bg-content1 rounded-lg p-5 flex flex-wrap items-end gap-3">
        <Input label="Name" variant="bordered" value={name} onValueChange={setName} className="max-w-xs" />
        <Input label="Phone" variant="bordered" value={phone} onValueChange={setPhone} className="max-w-xs" />
        <Button color="primary" radius="sm" onPress={addCustomer} isLoading={saving} className="font-semibold">
          + Add customer
        </Button>
      </div>

      <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
        <Table removeWrapper aria-label="Customers" className="min-w-[560px]">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>PHONE</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>ORDERS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No customers yet.">
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={c.type === "older" ? "secondary" : "warning"}>
                    {c.type}
                  </Chip>
                </TableCell>
                <TableCell>{c.orderCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
