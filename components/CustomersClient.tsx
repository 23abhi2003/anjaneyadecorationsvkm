"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { withOrderCounts, type CustomerWithCount } from "@/lib/customers";
import type { Customer, Order } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";

const POLL_INTERVAL_MS = 15000; // refetch customers every 15s to reflect newly placed orders

export default function CustomersClient({
  customers: initialCustomers,
  onAdded,
}: {
  customers: CustomerWithCount[];
  onAdded?: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [customers, setCustomers] = useState<CustomerWithCount[]>(initialCustomers);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const isMounted = useRef(true);

  // ---- delete state ----
  const [target, setTarget] = useState<CustomerWithCount | null>(null);
  const [alsoDeleteOrders, setAlsoDeleteOrders] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const { isOpen: deleteOpen, onOpen: openDelete, onOpenChange: onDeleteOpenChange } = useDisclosure();

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

  /**
   * Re-fetches customers AND orders together, then recomputes each customer's
   * order count. Fetching only /api/customers (as this used to) wiped the
   * ORDERS column to 0 on every poll — and the delete dialog depends on that
   * count being right, so it has to come from real order data.
   */
  const refreshCustomers = useCallback(async (showSpinner: boolean = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [customersRes, ordersRes] = await Promise.all([apiFetch("/api/customers"), apiFetch("/api/orders")]);
      if (customersRes.ok && ordersRes.ok) {
        const [customersData, ordersData] = await Promise.all([
          customersRes.json() as Promise<Customer[]>,
          ordersRes.json() as Promise<Order[]>,
        ]);
        if (isMounted.current) {
          setCustomers(withOrderCounts(customersData, ordersData));
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

  // ---- delete flow ----

  function askDelete(customer: CustomerWithCount): void {
    setTarget(customer);
    // Pre-tick the box when they have orders: deleting the customer alone
    // isn't possible in that case (the API rejects it), because saving any of
    // their orders would immediately re-create the customer.
    setAlsoDeleteOrders(customer.orderCount > 0);
    setDeleteError("");
    openDelete();
  }

  async function confirmDelete(close: () => void): Promise<void> {
    if (!target) return;
    setDeleting(true);
    setDeleteError("");

    // Re-read the live order count first, so we never send a stale "0 orders"
    // for someone who got an order a minute ago in another tab.
    const query = alsoDeleteOrders ? "?withOrders=true" : "";
    const res = await apiFetch(`/api/customers/${encodeURIComponent(target.id)}${query}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      orderCount?: number;
      deletedOrders?: number;
    };
    setDeleting(false);

    if (!res.ok) {
      if (res.status === 409 && typeof data.orderCount === "number") {
        // Server found orders we didn't know about — update the row and make
        // the user re-confirm with the checkbox ticked.
        setCustomers((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, orderCount: data.orderCount as number } : c))
        );
        setTarget({ ...target, orderCount: data.orderCount });
        setAlsoDeleteOrders(true);
      }
      setDeleteError(data.error || "Could not delete this customer.");
      return;
    }

    // Optimistically drop the row, then reconcile with the server.
    setCustomers((prev) => prev.filter((c) => c.id !== target.id));
    setNotice(
      data.deletedOrders
        ? `Deleted ${target.name} and ${data.deletedOrders} order${data.deletedOrders === 1 ? "" : "s"}.`
        : `Deleted ${target.name}.`
    );
    setTarget(null);
    close();
    onAdded?.();
    refreshCustomers(false);
  }

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);

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
          <Button size="sm" variant="solid" radius="sm" onPress={() => refreshCustomers(true)} isLoading={refreshing}>
            Refresh
          </Button>
        </div>
      </div>

      {notice && (
        <div className="bg-success/10 border border-success/40 text-success rounded-lg px-4 py-2 text-sm no-print">
          {notice}
        </div>
      )}

      <div className="bg-content1 rounded-lg p-5 flex flex-wrap items-end gap-3">
        <Input label="Name" variant="bordered" value={name} onValueChange={setName} className="max-w-xs" />
        <Input label="Phone" variant="bordered" value={phone} onValueChange={setPhone} className="max-w-xs" />
        <Button color="primary" radius="sm" onPress={addCustomer} isLoading={saving} className="font-semibold">
          + Add customer
        </Button>
      </div>

      <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
        <Table removeWrapper aria-label="Customers" className="min-w-[640px]">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>PHONE</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>ORDERS</TableColumn>
            <TableColumn>{isOwner ? "ACTIONS" : ""}</TableColumn>
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
                <TableCell>
                  {isOwner ? (
                    <Button
                      size="sm"
                      variant="bordered"
                      color="danger"
                      radius="sm"
                      className="no-print"
                      onPress={() => askDelete(c)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation. Two shapes, depending on whether the customer
          has orders — see askDelete() above. */}
      <Modal isOpen={deleteOpen} onOpenChange={onDeleteOpenChange} size="md">
        <ModalContent>
          {(onClose) => {
            if (!target) return null;
            const hasOrders = target.orderCount > 0;
            return (
              <>
                <ModalHeader style={{ fontFamily: "var(--font-display)" }}>Delete customer</ModalHeader>
                <ModalBody className="space-y-3">
                  <p className="text-sm text-foreground/80">
                    Delete <span className="font-semibold">{target.name}</span>
                    {target.phone ? ` (${target.phone})` : ""}? This can&apos;t be undone.
                  </p>

                  {hasOrders ? (
                    <>
                      <p className="text-sm text-warning">
                        This customer has {target.orderCount} order{target.orderCount === 1 ? "" : "s"}.
                      </p>
                      <Checkbox
                        isSelected={alsoDeleteOrders}
                        onValueChange={setAlsoDeleteOrders}
                        color="danger"
                        size="sm"
                      >
                        Also delete their {target.orderCount} order{target.orderCount === 1 ? "" : "s"} and remove those
                        jobs from staff assignments
                      </Checkbox>
                      {!alsoDeleteOrders && (
                        <p className="text-xs text-foreground/50">
                          Their orders must go too — an order that stays behind re-creates the customer the next time
                          it&apos;s saved.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-foreground/50">This customer has no orders.</p>
                  )}

                  {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" radius="sm" onPress={onClose} isDisabled={deleting}>
                    Cancel
                  </Button>
                  <Button
                    color="danger"
                    radius="sm"
                    className="font-semibold"
                    isLoading={deleting}
                    isDisabled={hasOrders && !alsoDeleteOrders}
                    onPress={() => confirmDelete(onClose)}
                  >
                    {hasOrders && alsoDeleteOrders ? "Delete customer + orders" : "Delete customer"}
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}