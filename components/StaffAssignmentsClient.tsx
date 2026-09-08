"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Chip,
  DateRangePicker,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { Pencil, Check, X, ArrowLeft } from "lucide-react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { StaffAssignmentRecord, StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";

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

  // Owner-only inline editing. Keyed by orderId since that's what the edit
  // endpoint is keyed on. Only one row can be edited at a time.
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editState, setEditState] = useState<RowEditState>({ amount: "", date: "", program: "", customerName: "" });
  const [savingRow, setSavingRow] = useState(false);
  const [rowError, setRowError] = useState("");

  // All hooks must run unconditionally before any early return below.
  const filtered = useMemo(
    () => (staff.assignments || []).filter((a) => withinRange(a.date, range)),
    [staff.assignments, range]
  );
  const total = filtered.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

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
    const res = await apiFetch(`/api/staff/${encodeURIComponent(staff.id)}/assignments/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editState),
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
          <div className="flex items-end gap-3 flex-wrap">
            <DateRangePicker
              label="Filter by date range"
              variant="bordered"
              value={range}
              onChange={setRange}
              maxValue={today(getLocalTimeZone())}
              className="max-w-xs"
            />
            {range && (
              <Button size="sm" variant="light" onPress={() => setRange(null)}>
                Clear filter
              </Button>
            )}
          </div>

          {filtered.length ? (
            <div className="overflow-x-auto">
              <Table aria-label={`${staff.name} assignments`} removeWrapper className="min-w-[640px]">
                <TableHeader>
                  <TableColumn>ORDER</TableColumn>
                  <TableColumn>CUSTOMER NAME</TableColumn>
                  <TableColumn>AMOUNT</TableColumn>
                  <TableColumn>DATE</TableColumn>
                  <TableColumn>{isOwner ? "ACTIONS" : ""}</TableColumn>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const isEditing = isOwner && editingOrderId === a.orderId;
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
                            `₹${a.amount || 0}`
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
                          {!isOwner ? null : isEditing ? (
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rowError && <p className="text-sm text-danger mt-2">{rowError}</p>}
            </div>
          ) : (
            <p className="text-sm text-foreground/60 py-6 text-center">
              {staff.assignments?.length ? "No assignments in this date range." : "No assignments yet."}
            </p>
          )}

          {filtered.length > 0 && isOwner && (
            <div className="flex justify-between bg-primary/10 border border-primary/40 rounded-md px-4 py-3">
              <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                {range ? "Total (in range)" : "Total"}
              </span>
              <Chip color="warning" variant="flat" className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                ₹{total.toLocaleString("en-IN")}
              </Chip>
            </div>
          )}

          {isOwner && (
            <p className="text-xs text-foreground/40">
              Editing here updates the underlying order too, so the fix sticks.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}