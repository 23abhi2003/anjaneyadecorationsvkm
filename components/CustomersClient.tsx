"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Card,
  CardBody,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { withOrderCounts, type CustomerWithCount } from "@/lib/customer";
import type { Customer, CustomerType, Order } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import Pagination from "@/components/pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";
import BackButton from "@/components/BackButton";

const POLL_INTERVAL_MS = 15000; // refetch customers every 15s to reflect newly placed orders

type TypeFilter = "all" | CustomerType;
type OrdersFilter = "all" | "with" | "without";

/** True if the free-text search matches this customer's name, phone, or "referred by". */
function matchesSearch(c: CustomerWithCount, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [c.name || "", c.phone || "", c.referredBy || ""];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

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

  // ---- filters, view, pagination ----
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [ordersFilter, setOrdersFilter] = useState<OrdersFilter>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const pageSize = MIN_PAGE_SIZE;

  const filtersActive = !!search || typeFilter !== "all" || ordersFilter !== "all";

  function clearFilters(): void {
    setSearch("");
    setTypeFilter("all");
    setOrdersFilter("all");
    setPage(1);
  }

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

  const filtered = useMemo(() => {
    return customers
      .filter((c) => matchesSearch(c, search))
      .filter((c) => typeFilter === "all" || c.type === typeFilter)
      .filter((c) => {
        if (ordersFilter === "all") return true;
        return ordersFilter === "with" ? c.orderCount > 0 : c.orderCount === 0;
      })
      // Newest first: assumes `id` is assigned in creation order (e.g. sequential
      // or timestamp-based). Swap this for a `createdAt` field if one exists on Customer.
      .sort((a, b) => (b.id || "").localeCompare(a.id || ""));
  }, [customers, search, typeFilter, ordersFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, ordersFilter]);

  const currentPage = clampPage(page, filtered.length, pageSize);
  const paged = useMemo(() => paginate(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <BackButton href="/" label="Back to Dashboard" />
      </div>

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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
          {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
        </p>
        <div className="flex items-center gap-1 bg-content2 rounded-md p-1 no-print">
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

      <div className="bg-content1 rounded-lg p-4 flex flex-wrap items-end gap-3 no-print">
        <Input
          label="Search"
          placeholder="Name, phone or referred by"
          variant="bordered"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
          startContent={<Search size={16} className="text-foreground/50" />}
          className="max-w-xs"
        />
        <Select
          label="Type"
          variant="bordered"
          selectedKeys={[typeFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as TypeFilter | undefined;
            if (next) setTypeFilter(next);
          }}
          disallowEmptySelection
          className="max-w-40"
        >
          <SelectItem key="all">All types</SelectItem>
          <SelectItem key="new">New</SelectItem>
          <SelectItem key="older">Older</SelectItem>
        </Select>
        <Select
          label="Orders"
          variant="bordered"
          selectedKeys={[ordersFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as OrdersFilter | undefined;
            if (next) setOrdersFilter(next);
          }}
          disallowEmptySelection
          className="max-w-45"
        >
          <SelectItem key="all">With &amp; without orders</SelectItem>
          <SelectItem key="with">Has orders</SelectItem>
          <SelectItem key="without">No orders yet</SelectItem>
        </Select>
        {filtersActive && (
          <Button size="sm" variant="light" onPress={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {view === "list" ? (
        <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
          <Table removeWrapper aria-label="Customers" className="min-w-[720px]">
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>PHONE</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>REFERRED BY</TableColumn>
              <TableColumn>ORDERS</TableColumn>
              <TableColumn>{isOwner ? "ACTIONS" : ""}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No customers match these filters.">
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={c.type === "older" ? "secondary" : "warning"}>
                      {c.type}
                    </Chip>
                  </TableCell>
                  <TableCell>{c.referredBy?.trim() || "—"}</TableCell>
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
      ) : paged.length === 0 ? (
        <div className="bg-content1 rounded-lg py-16 text-center text-sm text-foreground/50">
          No customers match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((c) => (
            <Card key={c.id} className="bg-content1 border border-divider">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{c.name}</p>
                  <Chip size="sm" variant="flat" color={c.type === "older" ? "secondary" : "warning"}>
                    {c.type}
                  </Chip>
                </div>
                <p className="text-sm text-foreground/70">{c.phone || "no phone on file"}</p>
                <p className="text-xs text-foreground/50">Referred by: {c.referredBy?.trim() || "—"}</p>
                <div className="flex items-center justify-between pt-2 border-t border-divider/60">
                  <span className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
                    {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
                  </span>
                  {isOwner && (
                    <Button size="sm" variant="bordered" color="danger" radius="sm" className="no-print" onPress={() => askDelete(c)}>
                      Delete
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} itemLabel="customers" onPageChange={setPage} />

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

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between no-print">
        <BackButton href="/" label="Back to Dashboard" />
      </div>
    </div>
  );
}