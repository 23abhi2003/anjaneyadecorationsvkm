"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Card,
  CardBody,
  Checkbox,
} from "@heroui/react";
import {
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Wallet,
} from "lucide-react";
import type { StaffAssignmentRecord, StaffBorrow, StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import {
  groupAssignmentsBySettlement,
  inr,
  nextSettlementNumber,
  parseAmt,
  type StaffSettlementSummary,
} from "@/lib/staffPay";

interface StaffSettlementModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  staff: StaffMember;
  selectedOrderIds: Set<string>;
  onClearSelection: () => void;
  onSelectAllUnsettled?: () => void;
  onSettlementCreated?: () => void;
  isOwner: boolean;
}

export default function StaffSettlementModal({
  isOpen,
  onOpenChange,
  staff,
  selectedOrderIds,
  onClearSelection,
  onSelectAllUnsettled,
  onSettlementCreated,
  isOwner,
}: StaffSettlementModalProps) {
  const suggestedNumber = useMemo(() => nextSettlementNumber(staff), [staff]);
  const [settlementNumberInput, setSettlementNumberInput] = useState<string>(String(suggestedNumber));
  const [selectedBorrowIds, setSelectedBorrowIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Deleting settlement state
  const [deletingNum, setDeletingNum] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Expanded previous settlement rows
  const [expandedSettlement, setExpandedSettlement] = useState<number | null>(null);

  // Sync default input when modal opens or suggestedNumber changes
  useEffect(() => {
    if (isOpen) {
      setSettlementNumberInput(String(suggestedNumber));
      setSelectedBorrowIds(new Set());
      setCreateError("");
      setCreateSuccess("");
      setDeleteError("");
      setDeletingNum(null);
    }
  }, [isOpen, suggestedNumber]);

  // Selected orders details
  const selectedAssignments = useMemo(() => {
    const list = staff.assignments || [];
    return list.filter((a) => selectedOrderIds.has(a.orderId));
  }, [staff.assignments, selectedOrderIds]);

  const selectedOrdersTotal = useMemo(() => {
    return selectedAssignments.reduce((sum, a) => sum + parseAmt(a.amount), 0);
  }, [selectedAssignments]);

  // Outstanding / due borrows that can be settled
  const dueBorrows = useMemo(() => {
    return (staff.borrows || []).filter(
      (b) => b.paymentStatus === "due" || (!b.paymentStatus && !b.settlementNumber)
    );
  }, [staff.borrows]);

  const selectedBorrows = useMemo(() => {
    return (staff.borrows || []).filter((b) => selectedBorrowIds.has(b.id));
  }, [staff.borrows, selectedBorrowIds]);

  const selectedBorrowsTotal = useMemo(() => {
    return selectedBorrows.reduce((sum, b) => sum + parseAmt(b.amount), 0);
  }, [selectedBorrows]);

  const netPayout = Math.max(0, selectedOrdersTotal - selectedBorrowsTotal);

  const unsettledAssignments = useMemo(() => {
    return (staff.assignments || []).filter(
      (a) => !a.settlementNumber || Number(a.settlementNumber) <= 0
    );
  }, [staff.assignments]);

  // Grouped previous settlements (including settled borrows)
  const { settlements, totalSettledAmount, totalSettledOrders } = useMemo(
    () => groupAssignmentsBySettlement(staff.assignments, staff.borrows),
    [staff.assignments, staff.borrows]
  );

  function toggleBorrow(id: string): void {
    setSelectedBorrowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateSettlement(): Promise<void> {
    if (!isOwner) return;
    const targetNum = parseInt(settlementNumberInput, 10);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setCreateError("Please enter a valid positive settlement number.");
      return;
    }
    if (selectedOrderIds.size === 0 && selectedBorrowIds.size === 0) {
      setCreateError("Please select at least one order or borrow to create a settlement.");
      return;
    }

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await apiFetch(`/api/staff/${encodeURIComponent(staff.id)}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementNumber: targetNum,
          orderIds: Array.from(selectedOrderIds),
          borrowIds: Array.from(selectedBorrowIds),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to create settlement.");
      }

      setCreateSuccess(`Settlement #${targetNum} created successfully!`);
      onClearSelection();
      setSelectedBorrowIds(new Set());
      onSettlementCreated?.();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create settlement.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSettlement(settlementNum: number): Promise<void> {
    if (!isOwner) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(
        `/api/staff/${encodeURIComponent(staff.id)}/settlements/${encodeURIComponent(settlementNum)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to delete settlement.");
      }

      setDeletingNum(null);
      onSettlementCreated?.();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete settlement.");
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpand(num: number): void {
    setExpandedSettlement((prev) => (prev === num ? null : num));
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      className="max-h-[90vh]"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 border-b border-divider pb-3">
              <Receipt size={22} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  Settlements — {staff.name}
                </h2>
                <p className="text-xs text-foreground/50 font-normal">
                  Manage payout settlements and view settlement history
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="space-y-6 py-4">
              {/* SECTION 1: CREATE NEW SETTLEMENT (OWNER ONLY) */}
              {isOwner && (
                <div className="space-y-3 bg-content2/60 rounded-xl p-4 border border-divider">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
                      Create New Settlement
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedOrderIds.size > 0 && (
                        <Chip color="primary" variant="flat" size="sm">
                          {selectedOrderIds.size} order{selectedOrderIds.size === 1 ? "" : "s"} &middot; {inr(selectedOrdersTotal)}
                        </Chip>
                      )}
                      {selectedBorrowIds.size > 0 && (
                        <Chip color="warning" variant="flat" size="sm">
                          -{inr(selectedBorrowsTotal)} borrow
                        </Chip>
                      )}
                    </div>
                  </div>

                  {selectedOrderIds.size === 0 && dueBorrows.length === 0 ? (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm space-y-2">
                      <div className="flex items-center gap-2 text-warning font-medium">
                        <AlertCircle size={16} />
                        <span>No orders currently selected</span>
                      </div>
                      <p className="text-xs text-foreground/70">
                        Use the checkboxes on the assignments page to select orders to settle, or click below to select all unsettled orders.
                      </p>
                      {unsettledAssignments.length > 0 && onSelectAllUnsettled && (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          radius="sm"
                          onPress={onSelectAllUnsettled}
                          className="font-medium"
                        >
                          Select All Unsettled Orders ({unsettledAssignments.length})
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Selected orders preview chips */}
                      {selectedAssignments.length > 0 && (
                        <div className="max-h-28 overflow-y-auto p-2 bg-content1 rounded-lg border border-divider space-y-1">
                          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1 px-1">
                            <span>Selected Orders ({selectedAssignments.length})</span>
                            <button
                              type="button"
                              onClick={onClearSelection}
                              className="text-primary hover:underline text-xs"
                            >
                              Deselect all
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedAssignments.map((a) => (
                              <Chip
                                key={a.orderId}
                                size="sm"
                                variant="flat"
                                color="primary"
                                className="text-xs"
                              >
                                <span className="font-semibold">{a.orderId}</span>: {a.program || a.customerName || "Order"} ({inr(parseAmt(a.amount))})
                              </Chip>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Optional: Deduct Due Borrows in this settlement */}
                      {dueBorrows.length > 0 && (
                        <div className="p-3 bg-content1 rounded-lg border border-warning/30 space-y-2">
                          <div className="flex items-center justify-between text-xs text-foreground/70">
                            <span className="font-semibold flex items-center gap-1.5 text-warning">
                              <Wallet size={14} />
                              Deduct Due Borrows in this Settlement (Optional)
                            </span>
                            <span className="text-[11px] text-foreground/50">
                              {dueBorrows.length} due borrow{dueBorrows.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                            {dueBorrows.map((b) => (
                              <label
                                key={b.id}
                                className="flex items-center justify-between p-1.5 rounded bg-content2/40 hover:bg-content2/70 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedBorrowIds.has(b.id)}
                                    onChange={() => toggleBorrow(b.id)}
                                    className="rounded border-foreground/30 accent-[#D9A427]"
                                  />
                                  <span>{b.reason || "Borrow"}</span>
                                  <span className="text-foreground/40 font-mono text-[11px]">{b.date}</span>
                                </div>
                                <span className="font-mono font-semibold text-warning">
                                  {inr(parseAmt(b.amount))}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary Net Calculation */}
                      <div className="flex items-center justify-between p-2.5 bg-content3/40 rounded-lg text-xs font-mono">
                        <span>
                          Orders: <strong className="text-primary">{inr(selectedOrdersTotal)}</strong>
                          {selectedBorrowsTotal > 0 && (
                            <> - Borrows: <strong className="text-warning">{inr(selectedBorrowsTotal)}</strong></>
                          )}
                        </span>
                        <span className="text-sm">
                          Net Payout: <strong className="text-success text-base">{inr(netPayout)}</strong>
                        </span>
                      </div>

                      {/* Settlement Number Input & Confirm */}
                      <div className="flex items-end gap-3 flex-wrap">
                        <Input
                          label="Settlement Number"
                          description={`Next recommended: #${suggestedNumber}`}
                          variant="bordered"
                          type="number"
                          min={1}
                          value={settlementNumberInput}
                          onValueChange={setSettlementNumberInput}
                          className="max-w-xs"
                          isRequired
                        />

                        <Button
                          color="primary"
                          radius="sm"
                          onPress={handleCreateSettlement}
                          isLoading={creating}
                          className="font-semibold shrink-0"
                          startContent={!creating && <Receipt size={16} />}
                        >
                          Confirm &amp; Create Settlement #{settlementNumberInput || "?"}
                        </Button>
                      </div>

                      {createError && (
                        <p className="text-sm text-danger flex items-center gap-1.5">
                          <AlertCircle size={15} />
                          {createError}
                        </p>
                      )}
                      {createSuccess && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-success/15 border border-success/30 rounded-lg text-sm text-success flex-wrap">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 size={16} />
                            {createSuccess}
                          </span>
                          <Button
                            as={Link}
                            href={`/settlements/detail?id=${encodeURIComponent(staff.id)}`}
                            size="sm"
                            color="success"
                            variant="flat"
                            radius="sm"
                            className="h-7 text-xs font-semibold"
                          >
                            Open Settlements Page &rarr;
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: PREVIOUS SETTLEMENTS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
                      Previous Settlements
                    </h3>
                    <p className="text-xs text-foreground/50">
                      History of settled payout batches for {staff.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Chip color="success" variant="flat" className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      Total Settled: {inr(totalSettledAmount)}
                    </Chip>
                    <Chip color="default" variant="bordered" size="sm">
                      {totalSettledOrders} order{totalSettledOrders === 1 ? "" : "s"} &middot; {settlements.length} batch{settlements.length === 1 ? "" : "es"}
                    </Chip>
                  </div>
                </div>

                {deleteError && (
                  <p className="text-sm text-danger flex items-center gap-1.5 bg-danger/10 p-2.5 rounded-lg border border-danger/30">
                    <AlertCircle size={15} />
                    {deleteError}
                  </p>
                )}

                {settlements.length === 0 ? (
                  <div className="text-center py-8 bg-content1 rounded-xl border border-divider space-y-1">
                    <p className="text-sm text-foreground/60">No settlements created yet for {staff.name}.</p>
                    <p className="text-xs text-foreground/40">
                      Select assigned orders above and create a settlement to record payouts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {settlements.map((s: StaffSettlementSummary) => {
                      const isExpanded = expandedSettlement === s.settlementNumber;
                      const isConfirmingDelete = deletingNum === s.settlementNumber;

                      return (
                        <Card key={s.settlementNumber} className="bg-content1 border border-divider">
                          <CardBody className="p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-base text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                                  #{s.settlementNumber}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">
                                      Settlement #{s.settlementNumber}
                                    </span>
                                    <Chip size="sm" variant="flat" color="success" className="font-semibold">
                                      {inr(s.total)}
                                    </Chip>
                                    {s.borrowsTotal > 0 && (
                                      <Chip size="sm" variant="flat" color="warning" className="font-semibold text-xs">
                                        -{inr(s.borrowsTotal)} borrow
                                      </Chip>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-foreground/50 mt-0.5 flex-wrap">
                                    {(s.startDate || s.endDate) && (
                                      <span className="flex items-center gap-1 text-primary">
                                        <Calendar size={12} />
                                        {s.startDate === s.endDate ? s.startDate : `${s.startDate || "—"} → ${s.endDate || "—"}`}
                                      </span>
                                    )}
                                    <span>&middot;</span>
                                    <span>{s.orderCount} order{s.orderCount === 1 ? "" : "s"}</span>
                                    {s.borrowCount > 0 && (
                                      <>
                                        <span>&middot;</span>
                                        <span className="text-warning">{s.borrowCount} borrow{s.borrowCount === 1 ? "" : "s"}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* DELETE SETTLEMENT OPTION (OWNER ONLY) */}
                                {isOwner && (
                                  <>
                                    {isConfirmingDelete ? (
                                      <div className="flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded border border-danger/30 text-xs">
                                        <span className="text-danger font-medium">Delete batch #{s.settlementNumber}?</span>
                                        <Button
                                          size="sm"
                                          color="danger"
                                          radius="sm"
                                          isLoading={deleting}
                                          onPress={() => handleDeleteSettlement(s.settlementNumber)}
                                          className="h-6 text-xs px-2.5 min-w-0 font-semibold"
                                        >
                                          Delete
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="light"
                                          radius="sm"
                                          isDisabled={deleting}
                                          onPress={() => setDeletingNum(null)}
                                          className="h-6 text-xs px-2 min-w-0"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        radius="sm"
                                        onPress={() => setDeletingNum(s.settlementNumber)}
                                        className="h-7 text-xs px-2 font-medium"
                                        startContent={<Trash2 size={13} />}
                                        title="Delete this settlement batch and move items back to active"
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="flat"
                                  radius="sm"
                                  onPress={() => toggleExpand(s.settlementNumber)}
                                  className="h-7 text-xs px-2 font-medium"
                                  endContent={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                >
                                  {isExpanded ? "Hide orders" : `View ${s.orderCount} orders`}
                                </Button>
                              </div>
                            </div>

                            {/* Collapsible orders & borrows list */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-divider/60 space-y-2">
                                <div className="text-xs text-foreground/50 font-medium px-1">
                                  Items included in Settlement #{s.settlementNumber}:
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {s.assignments.map((a: StaffAssignmentRecord) => (
                                    <div
                                      key={a.orderId}
                                      className="flex items-center justify-between p-2 bg-content2/50 rounded border border-divider/40 text-xs"
                                    >
                                      <div className="min-w-0 flex-1 mr-2">
                                        <div className="flex items-center gap-1.5">
                                          <Link
                                            href={`/orders/${encodeURIComponent(a.orderId)}`}
                                            className="font-semibold text-primary hover:underline"
                                          >
                                            {a.orderId}
                                          </Link>
                                          <span className="text-foreground/40 text-[11px] truncate">
                                            {a.date || "—"}
                                          </span>
                                        </div>
                                        <p className="text-foreground/70 truncate text-[11px]">
                                          {a.customerName || a.program || "Order"}
                                        </p>
                                      </div>
                                      <span className="font-mono font-semibold text-success shrink-0">
                                        {inr(parseAmt(a.amount))}
                                      </span>
                                    </div>
                                  ))}

                                  {s.borrows.map((b: StaffBorrow) => (
                                    <div
                                      key={b.id}
                                      className="flex items-center justify-between p-2 bg-warning/5 rounded border border-warning/30 text-xs"
                                    >
                                      <div className="min-w-0 flex-1 mr-2">
                                        <span className="font-semibold text-warning">
                                          Borrow: {b.reason || "Staff Borrow"}
                                        </span>
                                        <span className="text-foreground/40 text-[11px] ml-1">
                                          {b.date || "—"}
                                        </span>
                                      </div>
                                      <span className="font-mono font-semibold text-warning shrink-0">
                                        -{inr(parseAmt(b.amount))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardBody>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-divider">
              <Button variant="light" radius="sm" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
