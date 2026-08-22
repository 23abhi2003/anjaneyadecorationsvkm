"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Button, Chip } from "@heroui/react";
import type { CustomerWithCount } from "@/app/customers/page";
import { apiFetch } from "@/lib/api";

const POLL_INTERVAL_MS = 15000; // refetch customers every 15s to reflect newly placed orders

export default function CustomersClient({
  customers: initialCustomers,
  onAdded,
}: {
  customers: CustomerWithCount[];
  onAdded?: () => void;
}) {
  const [customers, setCustomers] = useState<CustomerWithCount[]>(initialCustomers);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Keep local state in sync if the parent re-renders with fresh server-fetched props
  // (e.g. after a Next.js router refresh).
  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const refreshCustomers = useCallback(async (showSpinner: boolean = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await apiFetch("/api/customers");
      if (res.ok) {
        const data = (await res.json()) as CustomerWithCount[];
        if (isMounted.current) {
          setCustomers(data);
          setLastSynced(new Date());
        }
      }
    } catch {
      // Silently ignore — next poll or focus event will retry.
    } finally {
      if (showSpinner && isMounted.current) setRefreshing(false);
    }
  }, []);

  // Poll on an interval so orders placed elsewhere (or by other staff) show up here automatically.
  useEffect(() => {
    const id = setInterval(() => {
      refreshCustomers(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCustomers]);

  // Also refresh whenever the tab regains focus or becomes visible again —
  // covers the case where an order was placed in another tab while this one was idle.
  useEffect(() => {
    function onFocus(): void {
      refreshCustomers(false);
    }
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") refreshCustomers(false);
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshCustomers]);

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
      refreshCustomers(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
          Customers
        </h1>
        <div className="flex items-center gap-3 no-print">
          <span className="text-xs text-[#F8F4E6]/40" style={{ fontFamily: "var(--font-mono)" }}>
            Synced {lastSynced.toLocaleTimeString()}
          </span>
          <Button
            size="sm"
            variant="solid"
            radius="sm"
            onPress={() => refreshCustomers(true)}
            isLoading={refreshing}
          >
            Refresh 
          </Button>
        </div>
      </div>

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