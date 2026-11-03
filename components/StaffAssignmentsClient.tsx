"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  DateRangePicker,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  useDisclosure,
} from "@heroui/react";
import { Pencil, Check, X, ArrowLeft, Wallet, Search, LayoutGrid, List as ListIcon, Receipt } from "lucide-react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { StaffAssignmentRecord, StaffMember, StaffPaymentStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import {
  assignmentMoney,
  groupAssignmentsBySettlement,
  inr,
  matchesOrderQuery,
  parseAmt,
  sortAssignmentsByDate,
  summarizeAssignments,
  type AssignmentSort,
} from "@/lib/staffPay";
import StaffPaymentsModal from "@/components/StaffPaymentsModal";
import StaffSettlementModal from "@/components/StaffSettlementModal";
import StaffBorrowsPanel from "@/components/StaffBorrowsPanel";
import Pagination from "@/components/pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";
import BackButton from "@/components/BackButton";

/** Parses an order/assignment date string (YYYY-MM-DD) into a comparable Date, tolerating blanks. */
function toDate(d?: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinRange(dateStr: string | undefined, range: RangeValue<DateValue> | null): boolean {
  if (!range) return true;
  const d = toDate(dateStr);
  if (!d) return false;
  const start = range.start.toDate(getLocalTimeZone());
  const end = range.end.toDate(getLocalTimeZone());
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

interface RowEditState {
  amount: string;
  date: string;
  program: string;
  customerName: string;
  paymentStatus: StaffPaymentStatus;
}

type PaymentFilter = "all" | StaffPaymentStatus;

export default function StaffAssignmentsClient({
  staff,
  onChanged,
}: {
  staff: StaffMember;
  /** Called after a successful edit so the parent can re-fetch the latest data. */
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isSelf = staff.id === user?.staffId;

  const [range, setRange] = useState<RangeValue<DateValue> | null>(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [sortOrder, setSortOrder] = useState<AssignmentSort>("newest");
  // Opening a staff member's assignments (or an invoice) goes straight to grid view.
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);

  // Settlement selection & modal state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const { isOpen: settlementOpen, onOpen: openSettlement, onOpenChange: onSettlementOpenChange } = useDisclosure();

  // Owner-only inline editing. Keyed by orderId since that's what the edit
  // endpoint is keyed on. Only one row can be edited at a time.
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editState, setEditState] = useState<RowEditState>({
    amount: "",
    date: "",
    program: "",
    customerName: "",
    paymentStatus: "due",
  });
  const [savingRow, setSavingRow] = useState(false);
  const [rowError, setRowError] = useState("");

  // Which assignment's advances modal is open (by orderId). The data itself is read from
  // `staff.assignments`, so it refreshes in place after a payment is added/removed.
  const [payOrderId, setPayOrderId] = useState<string | null>(null);

  // Any filter/sort change goes back to page 1 — otherwise a narrower result set can
  // strand the view on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [orderQuery, range, paymentFilter, sortOrder, pageSize]);

  // Active assignments that have not been settled yet (settled orders move to the settlements page)
  const activeAssignments = useMemo(
    () => (staff.assignments || []).filter((a) => !a.settlementNumber || Number(a.settlementNumber) <= 0),
    [staff.assignments]
  );

  // All hooks must run unconditionally before any early return below.
  const filtered = useMemo(
    () =>
      sortAssignmentsByDate(
        activeAssignments.filter((a) => {
          if (!withinRange(a.date, range)) return false;
          if (!matchesOrderQuery(a, orderQuery)) return false;
          if (paymentFilter !== "all") {
            const money = assignmentMoney(a);
            if (money.status !== paymentFilter) return false;
          }
          return true;
        }),
        sortOrder
      ),
    [activeAssignments, range, orderQuery, paymentFilter, sortOrder]
  );
  // Total always reflects everything active above: the order filter AND the date range.
  const totals = summarizeAssignments(filtered);
  const totalOrders = activeAssignments.length;
  const filtersActive = !!range || orderQuery.trim() !== "" || paymentFilter !== "all";

  // Page is clamped against the current filtered length, so a filter change that shrinks
  // the list (or a fresh assignment being added) never strands the view on an empty page.
  const currentPage = clampPage(page, filtered.length, pageSize);
  const paged = useMemo(() => paginate(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  // Settlement calculations
  const { settlements, totalSettledAmount, totalSettledOrders } = useMemo(
    () => groupAssignmentsBySettlement(staff.assignments, staff.borrows),
    [staff.assignments, staff.borrows]
  );

  const selectedOrders = useMemo(
    () => activeAssignments.filter((a) => selectedOrderIds.has(a.orderId)),
    [activeAssignments, selectedOrderIds]
  );

  const selectedTotal = useMemo(
    () => selectedOrders.reduce((sum, a) => sum + parseAmt(a.amount), 0),
    [selectedOrders]
  );

  function toggleOrder(orderId: string): void {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  // Toggle selection for all currently filtered orders
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedOrderIds.has(a.orderId));
  const someFilteredSelected = filtered.some((a) => selectedOrderIds.has(a.orderId));

  function toggleSelectAll(): void {
    if (allFilteredSelected) {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.orderId));
        return next;
      });
    } else {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a.orderId));
        return next;
      });
    }
  }

  const allPagedSelected = paged.length > 0 && paged.every((a) => selectedOrderIds.has(a.orderId));
  const somePagedSelected = paged.some((a) => selectedOrderIds.has(a.orderId));

  function toggleSelectAllPaged(): void {
    if (allPagedSelected) {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        paged.forEach((a) => next.delete(a.orderId));
        return next;
      });
    } else {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        paged.forEach((a) => next.add(a.orderId));
        return next;
      });
    }
  }

  function selectAllActive(): void {
    const next = new Set(selectedOrderIds);
    activeAssignments.forEach((a) => next.add(a.orderId));
    setSelectedOrderIds(next);
  }

  function clearSelection(): void {
    setSelectedOrderIds(new Set());
  }

  function clearFilters(): void {
    setRange(null);
    setOrderQuery("");
    setPaymentFilter("all");
    setPage(1);
  }

  // Staff can only view their own assignments; anyone else gets turned away.
  if (!isOwner && !isSelf) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">You don&apos;t have permission to view this staff member&apos;s assignments.</p>
        <Button as={Link} href="/staff" color="primary" radius="sm">
          Back to staff
        </Button>
      </div>
    );
  }

  function startEdit(a: StaffAssignmentRecord): void {
    setEditingOrderId(a.orderId);
    setEditState({
      amount: a.amount || "",
      date: a.date || "",
      program: a.program || "",
      customerName: a.customerName || "",
      paymentStatus: a.paymentStatus === "paid" ? "paid" : "due",
    });
    setRowError("");
  }

  function cancelEdit(): void {
    setEditingOrderId(null);
    setRowError("");
  }

  async function saveRow(orderId: string): Promise<void> {
    setSavingRow(true);
    setRowError("");
    // Only send the status if it was actually changed, so editing just the amount lets the
    // server settle the job automatically when advances already cover the new amount.
    const original = (staff.assignments || []).find((x) => x.orderId === orderId);
    const originalStatus: StaffPaymentStatus = original?.paymentStatus === "paid" ? "paid" : "due";
    const { paymentStatus, ...fields } = editState;
    const body = paymentStatus !== originalStatus ? { ...fields, paymentStatus } : fields;
    const res = await apiFetch(`/api/staff/${encodeURIComponent(staff.id)}/assignments/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingRow(false);
    if (res.ok) {
      setEditingOrderId(null);
      onChanged?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setRowError((data as { error?: string }).error || "Could not save changes.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <BackButton href="/staff" label="Back to Staff" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
          {staff.name} — assignments
        </h1>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Active Assignments
              </h2>
              {isOwner && (
                <Button
                  size="sm"
                  color={selectedOrderIds.size > 0 ? "primary" : "default"}
                  variant={selectedOrderIds.size > 0 ? "solid" : "bordered"}
                  radius="sm"
                  onPress={openSettlement}
                  className="font-semibold"
                  startContent={<Receipt size={16} />}
                >
                  {selectedOrderIds.size > 0
                    ? `Create Settlement (${selectedOrderIds.size}) · ${inr(selectedTotal)}`
                    : `Create Settlement`}
                </Button>
              )}
              <Button
                as={Link}
                href={`/settlements/detail?id=${encodeURIComponent(staff.id)}`}
                size="sm"
                variant="flat"
                color="secondary"
                radius="sm"
                className="font-medium"
                startContent={<Receipt size={16} />}
              >
                View Settlements {settlements.length > 0 ? `(${settlements.length})` : ""}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isOwner && filtered.length > 0 && (
                <Button
                  size="sm"
                  variant={allFilteredSelected ? "solid" : "bordered"}
                  color={allFilteredSelected ? "primary" : "default"}
                  radius="sm"
                  onPress={toggleSelectAll}
                  className="font-medium"
                >
                  {allFilteredSelected ? "Deselect All" : `Select All (${filtered.length})`}
                </Button>
              )}
              <div className="flex items-center gap-1 bg-content2 rounded-md p-1">
                <Button
                  isIconOnly
                  size="sm"
                  radius="sm"
                  variant={viewMode === "list" ? "solid" : "light"}
                  color={viewMode === "list" ? "primary" : "default"}
                  onPress={() => setViewMode("list")}
                  aria-label="List view"
                  title="List view"
                >
                  <ListIcon size={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  radius="sm"
                  variant={viewMode === "grid" ? "solid" : "light"}
                  color={viewMode === "grid" ? "primary" : "default"}
                  onPress={() => setViewMode("grid")}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <LayoutGrid size={16} />
                </Button>
              </div>
            </div>
          </div>

          {settlements.length > 0 && (
            <div className="flex items-center justify-between gap-2 bg-secondary/10 border border-secondary/30 rounded-lg px-3.5 py-2 text-xs flex-wrap">
              <span className="text-foreground/80">
                <span className="font-semibold text-secondary">{settlements.length} settlement batch{settlements.length === 1 ? "" : "es"}</span> ({inr(totalSettledAmount)} settled). Settled orders are automatically moved to the settlements page.
              </span>
              <Button
                as={Link}
                href={`/settlements/detail?id=${encodeURIComponent(staff.id)}`}
                size="sm"
                variant="light"
                color="secondary"
                radius="sm"
                className="h-6 text-xs px-2.5 font-medium"
              >
                View Settlements &rarr;
              </Button>
            </div>
          )}

          {selectedOrderIds.size > 0 && isOwner && (
            <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/40 rounded-lg px-4 py-2.5 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-primary" />
                <span className="font-semibold text-foreground">
                  {selectedOrderIds.size} order{selectedOrderIds.size === 1 ? "" : "s"} selected
                </span>
                <span className="text-foreground/40">&middot;</span>
                <span className="font-bold text-primary font-mono">{inr(selectedTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={allFilteredSelected ? "solid" : "bordered"}
                  radius="sm"
                  onPress={toggleSelectAll}
                >
                  {allFilteredSelected ? "Deselect All" : `Select All (${filtered.length})`}
                </Button>
                <Button size="sm" variant="light" radius="sm" onPress={clearSelection}>
                  Clear selection
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  radius="sm"
                  className="font-semibold"
                  onPress={openSettlement}
                  startContent={<Receipt size={15} />}
                >
                  Create Settlement
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <Input
              label="Filter by order"
              placeholder="Order no., program or customer"
              variant="bordered"
              value={orderQuery}
              onValueChange={setOrderQuery}
              isClearable
              onClear={() => setOrderQuery("")}
              startContent={<Search size={16} className="text-foreground/50" />}
              className="max-w-xs"
            />
            <DateRangePicker
              label="Filter by date range"
              variant="bordered"
              value={range}
              onChange={setRange}
              maxValue={today(getLocalTimeZone())}
              className="max-w-xs"
            />
            <Select
              label="Payment status"
              variant="bordered"
              selectedKeys={[paymentFilter]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as PaymentFilter | undefined;
                if (next) setPaymentFilter(next);
              }}
              disallowEmptySelection
              className="max-w-48"
            >
              <SelectItem key="all" textValue="All (due & paid)">
                All (due &amp; paid)
              </SelectItem>
              <SelectItem key="due" textValue="Due">
                Due
              </SelectItem>
              <SelectItem key="paid" textValue="Paid">
                Paid
              </SelectItem>
            </Select>
            <Select
              label="Sort by date"
              variant="bordered"
              selectedKeys={[sortOrder]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as AssignmentSort | undefined;
                if (next) setSortOrder(next);
              }}
              disallowEmptySelection
              className="max-w-55"
            >
              <SelectItem key="newest">Newest first (present → past)</SelectItem>
              <SelectItem key="oldest">Oldest first (past → present)</SelectItem>
            </Select>
            {filtersActive && (
              <Button size="sm" variant="light" onPress={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length ? (
            viewMode === "list" ? (
            <div className="overflow-x-auto">
              <Table aria-label={`${staff.name} assignments`} removeWrapper className="min-w-160">
                <TableHeader>
                  <TableColumn width={46}>
                    {isOwner ? (
                      <Checkbox
                        isSelected={allFilteredSelected && filtered.length > 0}
                        isIndeterminate={someFilteredSelected && !allFilteredSelected}
                        onValueChange={toggleSelectAll}
                        aria-label="Select all filtered orders"
                      />
                    ) : null}
                  </TableColumn>
                  <TableColumn>ORDER</TableColumn>
                  <TableColumn>CUSTOMER NAME</TableColumn>
                  <TableColumn>AMOUNT</TableColumn>
                  <TableColumn>DATE</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody>
                  {paged.map((a) => {
                    const isEditing = isOwner && editingOrderId === a.orderId;
                    const money = assignmentMoney(a);
                    return (
                      <TableRow key={a.orderId} className={selectedOrderIds.has(a.orderId) ? "bg-primary/5" : undefined}>
                        <TableCell>
                          {isOwner ? (
                            <Checkbox
                              isSelected={selectedOrderIds.has(a.orderId)}
                              onValueChange={() => toggleOrder(a.orderId)}
                              aria-label={`Select order ${a.orderId}`}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-foreground/40 text-xs">{a.orderId}</span>
                              <Input
                                aria-label="Program"
                                size="sm"
                                variant="bordered"
                                value={editState.program}
                                onValueChange={(v) => setEditState({ ...editState, program: v })}
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground/40 mr-1">{a.orderId}</span>
                                {a.settlementNumber && Number(a.settlementNumber) > 0 && (
                                  <Chip size="sm" variant="flat" color="secondary" className="h-5 text-[10px] px-1.5 font-semibold">
                                    #{a.settlementNumber}
                                  </Chip>
                                )}
                              </div>
                              <span>{a.program}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              aria-label="Customer name"
                              size="sm"
                              variant="bordered"
                              value={editState.customerName}
                              onValueChange={(v) => setEditState({ ...editState, customerName: v })}
                            />
                          ) : (
                            a.customerName
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              aria-label="Amount"
                              size="sm"
                              variant="bordered"
                              inputMode="decimal"
                              startContent={<span className="text-foreground/50">₹</span>}
                              value={editState.amount}
                              onValueChange={(v) => setEditState({ ...editState, amount: v.replace(/[^\d.]/g, "") })}
                            />
                          ) : (
                            <div>
                              <p>{inr(money.total)}</p>
                              {money.status === "due" && money.advances > 0 && (
                                <p className="text-xs text-foreground/50">
                                  Advance {inr(money.advances)} &middot; Due {inr(money.due)}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              aria-label="Date"
                              type="date"
                              size="sm"
                              variant="bordered"
                              value={editState.date}
                              onValueChange={(v) => setEditState({ ...editState, date: v })}
                            />
                          ) : (
                            a.date || "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              {(["due", "paid"] as const).map((st) => (
                                <Button
                                  key={st}
                                  size="sm"
                                  radius="full"
                                  variant={editState.paymentStatus === st ? "solid" : "bordered"}
                                  color={editState.paymentStatus === st ? (st === "paid" ? "success" : "warning") : "default"}
                                  onPress={() => setEditState({ ...editState, paymentStatus: st })}
                                >
                                  {st === "paid" ? "Paid" : "Due"}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 items-start">
                              <Chip size="sm" variant="flat" color={money.status === "paid" ? "success" : "warning"}>
                                {money.status === "paid" ? "Paid" : "Due"}
                              </Chip>
                              {a.settlementNumber && Number(a.settlementNumber) > 0 && (
                                <span className="text-[11px] text-secondary font-medium whitespace-nowrap">
                                  Settlement #{a.settlementNumber}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                color="primary"
                                radius="sm"
                                isLoading={savingRow}
                                onPress={() => saveRow(a.orderId)}
                                aria-label="Save"
                              >
                                <Check size={16} />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="bordered"
                                radius="sm"
                                onPress={cancelEdit}
                                isDisabled={savingRow}
                                aria-label="Cancel"
                              >
                                <X size={16} />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="success"
                                radius="sm"
                                onPress={() => setPayOrderId(a.orderId)}
                                aria-label={isOwner ? "Record or view advances" : "View advances"}
                                title={isOwner ? "Advances given" : "View advances"}
                              >
                                <Wallet size={16} />
                              </Button>
                              {isOwner && (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  radius="sm"
                                  onPress={() => startEdit(a)}
                                  aria-label="Edit assignment"
                                >
                                  <Pencil size={16} />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rowError && <p className="text-sm text-danger mt-2">{rowError}</p>}
            </div>
            ) : (
              <div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {paged.map((a) => {
                    const isEditing = isOwner && editingOrderId === a.orderId;
                    const money = assignmentMoney(a);
                    return (
                      <Card
                        key={a.orderId}
                        className={`bg-content1 border transition-colors ${
                          selectedOrderIds.has(a.orderId)
                            ? "border-primary ring-1 ring-primary/40"
                            : "border-divider"
                        }`}
                      >
                        <CardBody className="p-4 space-y-2">
                          {isEditing ? (
                            <div className="space-y-2">
                              <span className="text-foreground/40 text-xs">{a.orderId}</span>
                              <Input
                                aria-label="Program"
                                label="Program"
                                size="sm"
                                variant="bordered"
                                value={editState.program}
                                onValueChange={(v) => setEditState({ ...editState, program: v })}
                              />
                              <Input
                                aria-label="Customer name"
                                label="Customer"
                                size="sm"
                                variant="bordered"
                                value={editState.customerName}
                                onValueChange={(v) => setEditState({ ...editState, customerName: v })}
                              />
                              <Input
                                aria-label="Amount"
                                label="Amount"
                                size="sm"
                                variant="bordered"
                                inputMode="decimal"
                                startContent={<span className="text-foreground/50">₹</span>}
                                value={editState.amount}
                                onValueChange={(v) => setEditState({ ...editState, amount: v.replace(/[^\d.]/g, "") })}
                              />
                              <Input
                                aria-label="Date"
                                label="Date"
                                type="date"
                                size="sm"
                                variant="bordered"
                                value={editState.date}
                                onValueChange={(v) => setEditState({ ...editState, date: v })}
                              />
                              <div className="flex gap-1">
                                {(["due", "paid"] as const).map((st) => (
                                  <Button
                                    key={st}
                                    size="sm"
                                    radius="full"
                                    variant={editState.paymentStatus === st ? "solid" : "bordered"}
                                    color={editState.paymentStatus === st ? (st === "paid" ? "success" : "warning") : "default"}
                                    onPress={() => setEditState({ ...editState, paymentStatus: st })}
                                  >
                                    {st === "paid" ? "Paid" : "Due"}
                                  </Button>
                                ))}
                              </div>
                              <div className="flex items-center gap-1 pt-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  color="primary"
                                  radius="sm"
                                  isLoading={savingRow}
                                  onPress={() => saveRow(a.orderId)}
                                  aria-label="Save"
                                >
                                  <Check size={16} />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="bordered"
                                  radius="sm"
                                  onPress={cancelEdit}
                                  isDisabled={savingRow}
                                  aria-label="Cancel"
                                >
                                  <X size={16} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  {isOwner && (
                                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        isSelected={selectedOrderIds.has(a.orderId)}
                                        onValueChange={() => toggleOrder(a.orderId)}
                                        aria-label={`Select order ${a.orderId}`}
                                      />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs text-foreground/40 font-mono">{a.orderId}</p>
                                      {a.settlementNumber && Number(a.settlementNumber) > 0 && (
                                        <Chip size="sm" variant="flat" color="secondary" className="h-5 text-[10px] px-1.5 font-semibold">
                                          Settlement #{a.settlementNumber}
                                        </Chip>
                                      )}
                                    </div>
                                    <p className="font-semibold truncate">{a.program}</p>
                                    <p className="text-sm text-foreground/70 truncate">{a.customerName}</p>
                                  </div>
                                </div>
                                <Chip size="sm" variant="flat" color={money.status === "paid" ? "success" : "warning"}>
                                  {money.status === "paid" ? "Paid" : "Due"}
                                </Chip>
                              </div>
                              <div className="flex items-end justify-between gap-2">
                                <div>
                                  <p className="font-semibold">{inr(money.total)}</p>
                                  {money.status === "due" && money.advances > 0 && (
                                    <p className="text-xs text-foreground/50">
                                      Advance {inr(money.advances)} &middot; Due {inr(money.due)}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xs text-foreground/50">{a.date || "—"}</p>
                              </div>
                              <div className="flex items-center gap-1 pt-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  color="success"
                                  radius="sm"
                                  onPress={() => setPayOrderId(a.orderId)}
                                  aria-label={isOwner ? "Record or view advances" : "View advances"}
                                  title={isOwner ? "Advances given" : "View advances"}
                                >
                                  <Wallet size={16} />
                                </Button>
                                {isOwner && (
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    radius="sm"
                                    onPress={() => startEdit(a)}
                                    aria-label="Edit assignment"
                                  >
                                    <Pencil size={16} />
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
                {rowError && <p className="text-sm text-danger mt-2">{rowError}</p>}
              </div>
            )
          ) : (
            <p className="text-sm text-foreground/60 py-6 text-center">
              {totalOrders ? "No assignments match the current filters." : "No assignments yet."}
            </p>
          )}

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            itemLabel="assignments"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            tone="light"
          />

          {filtered.length > 0 && (isOwner || isSelf) && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/10 border border-primary/40 rounded-md px-4 py-3">
              <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                {filtersActive
                  ? `Total (${filtered.length} of ${totalOrders} order${totalOrders === 1 ? "" : "s"})`
                  : `Total (${filtered.length} order${filtered.length === 1 ? "" : "s"})`}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Chip color="warning" variant="flat" className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {inr(totals.total)}
                </Chip>
                <Chip color="success" variant="flat" className="font-semibold">
                  Paid {inr(totals.paid)}
                </Chip>
                <Chip color="danger" variant="flat" className="font-semibold">
                  Due {inr(totals.due)}
                </Chip>
                {totalSettledAmount > 0 && (
                  <Chip color="secondary" variant="flat" className="font-semibold">
                    Settled {inr(totalSettledAmount)}
                  </Chip>
                )}
              </div>
            </div>
          )}

          {isOwner && (
            <p className="text-xs text-foreground/40">
              Editing here updates the underlying order too, so the fix sticks. Paid means fully settled; use checkboxes
              to select orders and create settlement batches.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="bg-content1">
        <CardBody className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Borrows
            </h2>
            <p className="text-xs text-foreground/50">
              Money borrowed from the owner. It is subtracted from the total of all orders assigned to {staff.name} (the
              date filter above doesn&apos;t apply).
            </p>
          </div>
          <StaffBorrowsPanel staff={staff} isOwner={isOwner} onChanged={() => onChanged?.()} />
        </CardBody>
      </Card>

      <StaffPaymentsModal
        staff={staff}
        assignment={(staff.assignments || []).find((x) => x.orderId === payOrderId) ?? null}
        isOwner={isOwner}
        onClose={() => setPayOrderId(null)}
        onChanged={() => onChanged?.()}
      />

      <StaffSettlementModal
        isOpen={settlementOpen}
        onOpenChange={onSettlementOpenChange}
        staff={staff}
        selectedOrderIds={selectedOrderIds}
        onClearSelection={clearSelection}
        onSelectAllUnsettled={selectAllActive}
        onSettlementCreated={() => onChanged?.()}
        isOwner={isOwner}
      />

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between no-print">
        <BackButton href="/staff" label="Back to Staff" />
      </div>
    </div>
  );
}