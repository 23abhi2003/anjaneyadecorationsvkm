"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
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
} from "@heroui/react";
import { Pencil, Check, X, ArrowLeft, Wallet, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { StaffAssignmentRecord, StaffMember, StaffPaymentStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import {
  assignmentMoney,
  inr,
  matchesOrderQuery,
  sortAssignmentsByDate,
  summarizeAssignments,
  type AssignmentSort,
} from "@/lib/staffPay";
import StaffPaymentsModal from "@/components/StaffPaymentsModal";
import StaffBorrowsPanel from "@/components/StaffBorrowsPanel";
import Pagination from "@/components/Pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";

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
  const [sortOrder, setSortOrder] = useState<AssignmentSort>("newest");
  // Opening a staff member's assignments (or an invoice) goes straight to grid view.
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);

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
  }, [orderQuery, range, sortOrder, pageSize]);

  // All hooks must run unconditionally before any early return below.
  const filtered = useMemo(
    () =>
      sortAssignmentsByDate(
        (staff.assignments || []).filter((a) => withinRange(a.date, range) && matchesOrderQuery(a, orderQuery)),
        sortOrder
      ),
    [staff.assignments, range, orderQuery, sortOrder]
  );
  // Total always reflects everything active above: the order filter AND the date range.
  const totals = summarizeAssignments(filtered);
  const totalOrders = (staff.assignments || []).length;
  const filtersActive = !!range || orderQuery.trim() !== "";

  // Page is clamped against the current filtered length, so a filter change that shrinks
  // the list (or a fresh assignment being added) never strands the view on an empty page.
  const currentPage = clampPage(page, filtered.length, pageSize);
  const paged = useMemo(() => paginate(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  function clearFilters(): void {
    setRange(null);
    setOrderQuery("");
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
      <div className="flex items-center gap-3 flex-wrap">
        <Button as={Link} href="/staff" isIconOnly variant="light" radius="sm" aria-label="Back to staff">
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
          {staff.name} — assignments
        </h1>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Assignments
            </h2>
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
                      <TableRow key={a.orderId}>
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
                            <>
                              <span className="text-foreground/40 mr-1">{a.orderId}</span>
                              {a.program}
                            </>
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
                            <Chip size="sm" variant="flat" color={money.status === "paid" ? "success" : "warning"}>
                              {money.status === "paid" ? "Paid" : "Due"}
                            </Chip>
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
                      <Card key={a.orderId} className="bg-content1 border border-divider">
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
                                <div className="min-w-0">
                                  <p className="text-xs text-foreground/40">{a.orderId}</p>
                                  <p className="font-semibold truncate">{a.program}</p>
                                  <p className="text-sm text-foreground/70 truncate">{a.customerName}</p>
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
              </div>
            </div>
          )}

          {isOwner && (
            <p className="text-xs text-foreground/40">
              Editing here updates the underlying order too, so the fix sticks. Paid means fully settled; use the
              wallet button to record advances given before that — they are subtracted from the amount.
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
    </div>
  );
}