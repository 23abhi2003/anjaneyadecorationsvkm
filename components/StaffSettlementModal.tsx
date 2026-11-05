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

      setCreateSuccess(`Settlement #${targetNum} created successfully! Items have been cleared.`);
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
      className="max-h-[92vh]"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2 border-b border-divider pb-3">
              <Receipt size={22} className="text-primary shrink-0" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  Settlements — {staff.name}
                </h2>
                <p className="text-xs text-foreground/50 font-normal">
                  Manage payout settlements and view settlement history
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="space-y-5 py-4">
              {/* SECTION 1: CREATE NEW SETTLEMENT (OWNER ONLY) */}
              {isOwner && (
                <div className="space-y-3 bg-content2/50 rounded-xl p-3.5 sm:p-4 border border-divider">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                      Create New Settlement
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedOrderIds.size > 0 && (
                        <Chip color="primary" variant="flat" size="sm">
                          {selectedOrderIds.size} {selectedOrderIds.size === 1 ? "order" : "orders"} &middot; {inr(selectedOrdersTotal)}
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
                    <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs sm:text-sm space-y-2">
                      <div className="flex items-center gap-2 text-warning font-semibold">
                        <AlertCircle size={16} className="shrink-0" />
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
                          className="font-semibold"
                        >
                          Select All Unsettled Orders ({unsettledAssignments.length})
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Selected orders preview chips */}
                      {selectedAssignments.length > 0 && (
                        <div className="max-h-28 overflow-y-auto p-2.5 bg-content1 rounded-lg border border-divider space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-foreground/60 px-1">
                            <span>Selected Orders ({selectedAssignments.length})</span>
                            <button
                              type="button"
                              onClick={onClearSelection}
                              className="text-primary hover:underline text-xs font-medium"
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
                                <span className="font-semibold font-mono">{a.orderId}</span>: {a.program || a.customerName || "Order"} ({inr(parseAmt(a.amount))})
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
                              {dueBorrows.length} due
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                            {dueBorrows.map((b) => (
                              <label
                                key={b.id}
                                className="flex items-center justify-between p-2 rounded bg-content2/40 hover:bg-content2/70 cursor-pointer text-xs border border-divider/50"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedBorrowIds.has(b.id)}
                                    onChange={() => toggleBorrow(b.id)}
                                    className="rounded border-foreground/30 accent-primary w-4 h-4"
                                  />
                                  <span className="text-foreground font-medium">{b.reason || "Borrow"}</span>
                                  <span className="text-foreground/50 font-mono text-[11px]">{b.date}</span>
                                </div>
                                <span className="font-mono font-bold text-warning">
                                  {inr(parseAmt(b.amount))}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary Net Calculation */}
                      <div className="flex items-center justify-between p-2.5 bg-content1 rounded-lg text-xs font-mono border border-divider">
                        <span className="text-foreground/80">
                          Orders: <strong className="text-success">{inr(selectedOrdersTotal)}</strong>
                          {selectedBorrowsTotal > 0 && (
                            <> - Borrows: <strong className="text-warning">{inr(selectedBorrowsTotal)}</strong></>
                          )}
                        </span>
                        <span>
                          Net: <strong className="text-primary text-sm font-bold">{inr(netPayout)}</strong>
                        </span>
                      </div>

                      {/* Settlement Number Input & Confirm */}
                      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <Input
                          label="Settlement Number"
                          description={`Next recommended: #${suggestedNumber}`}
                          variant="bordered"
                          type="number"
                          min={1}
                          value={settlementNumberInput}
                          onValueChange={setSettlementNumberInput}
                          isRequired
                          className="w-full sm:max-w-xs"
                        />

                        <Button
                          color="primary"
                          radius="sm"
                          onPress={handleCreateSettlement}
                          isLoading={creating}
                          className="w-full sm:w-auto font-bold shrink-0 h-10"
                          startContent={!creating && <Receipt size={16} />}
                        >
                          Confirm &amp; Create Settlement #{settlementNumberInput || "?"}
                        </Button>
                      </div>

                      {createError && (
                        <p className="text-xs sm:text-sm text-danger flex items-center gap-1.5 bg-danger/10 p-2.5 rounded-lg border border-danger/30">
                          <AlertCircle size={15} className="shrink-0" />
                          {createError}
                        </p>
                      )}
                      {createSuccess && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-success/10 border border-success/30 rounded-lg text-xs sm:text-sm text-success flex-wrap">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 size={16} className="shrink-0" />
                            {createSuccess}
                          </span>
                          <Link
                            href={`/settlements/detail?id=${encodeURIComponent(staff.id)}`}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Open Settlements Page &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: PREVIOUS SETTLEMENTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                      Previous Settlements
                    </h3>
                    <p className="text-xs text-foreground/50">
                      History of settled payout batches for {staff.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Chip color="success" variant="flat" size="sm" className="font-semibold font-mono">
                      Total: {inr(totalSettledAmount)}
                    </Chip>
                    <Chip color="default" variant="bordered" size="sm" className="font-mono">
                      {settlements.length} {settlements.length === 1 ? "batch" : "batches"}
                    </Chip>
                  </div>
                </div>

                {deleteError && (
                  <p className="text-xs sm:text-sm text-danger flex items-center gap-1.5 bg-danger/10 p-2.5 rounded-lg border border-danger/30">
                    <AlertCircle size={15} className="shrink-0" />
                    {deleteError}
                  </p>
                )}

                {settlements.length === 0 ? (
                  <div className="text-center py-6 bg-content2/30 rounded-xl border border-divider space-y-1">
                    <p className="text-xs sm:text-sm text-foreground/60">No settlements created yet for {staff.name}.</p>
                    <p className="text-xs text-foreground/40">
                      Select assigned orders above and create a settlement to record payouts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settlements.map((s: StaffSettlementSummary) => {
                      const isExpanded = expandedSettlement === s.settlementNumber;
                      const isConfirmingDelete = deletingNum === s.settlementNumber;

                      return (
                        <Card key={s.settlementNumber} className="bg-content1 border border-divider shadow-xs">
                          <CardBody className="p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-primary font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                                  #{s.settlementNumber}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                                      Settlement #{s.settlementNumber}
                                    </span>
                                    <Chip size="sm" variant="flat" color="success" className="font-semibold h-5 text-[11px]">
                                      {inr(s.total)}
                                    </Chip>
                                    {s.borrowsTotal > 0 && (
                                      <Chip size="sm" variant="flat" color="warning" className="font-semibold h-5 text-[11px]">
                                        -{inr(s.borrowsTotal)} borrow
                                      </Chip>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-foreground/50 mt-0.5 font-mono">
                                    <Calendar size={11} className="text-primary" />
                                    <span>{s.startDate === s.endDate ? s.startDate : `${s.startDate || "—"} → ${s.endDate || "—"}`}</span>
                                    <span>&middot;</span>
                                    <span>{s.orderCount} orders</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isOwner && (
                                  isConfirmingDelete ? (
                                    <div className="flex items-center gap-1 bg-danger/10 px-2 py-0.5 rounded border border-danger/30 text-[11px]">
                                      <span className="text-danger font-medium">Delete?</span>
                                      <Button
                                        size="sm"
                                        color="danger"
                                        radius="sm"
                                        isLoading={deleting}
                                        onPress={() => handleDeleteSettlement(s.settlementNumber)}
                                        className="h-5 text-[11px] px-2 min-w-0 font-bold"
                                      >
                                        Yes
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="light"
                                        radius="sm"
                                        isDisabled={deleting}
                                        onPress={() => setDeletingNum(null)}
                                        className="h-5 text-[11px] px-1 min-w-0 text-foreground/60"
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      radius="sm"
                                      onPress={() => setDeletingNum(s.settlementNumber)}
                                      className="h-6 text-xs px-2"
                                      startContent={<Trash2 size={12} />}
                                      title="Delete this settlement batch"
                                    >
                                      Delete
                                    </Button>
                                  )
                                )}

                                <Button
                                  size="sm"
                                  variant="bordered"
                                  radius="sm"
                                  onPress={() => toggleExpand(s.settlementNumber)}
                                  className="h-6 text-xs px-2"
                                  endContent={isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                >
                                  {isExpanded ? "Hide" : `View (${s.orderCount})`}
                                </Button>
                              </div>
                            </div>

                            {/* Collapsible orders & borrows list */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-divider/60 space-y-1.5">
                                <div className="text-[11px] text-foreground/50 font-semibold px-1">
                                  Items in Settlement #{s.settlementNumber}:
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {s.assignments.map((a: StaffAssignmentRecord) => (
                                    <div
                                      key={a.orderId}
                                      className="flex items-center justify-between p-2 bg-content2/40 rounded-lg border border-divider/40 text-xs"
                                    >
                                      <div className="min-w-0 flex-1 mr-2">
                                        <div className="flex items-center gap-1.5">
                                          <Link
                                            href={`/orders/${encodeURIComponent(a.orderId)}`}
                                            className="font-bold text-primary font-mono hover:underline"
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
                                      <span className="font-mono font-bold text-success shrink-0">
                                        {inr(parseAmt(a.amount))}
                                      </span>
                                    </div>
                                  ))}

                                  {s.borrows.map((b: StaffBorrow) => (
                                    <div
                                      key={b.id}
                                      className="flex items-center justify-between p-2 bg-warning/5 rounded-lg border border-warning/20 text-xs"
                                    >
                                      <div className="min-w-0 flex-1 mr-2">
                                        <span className="font-semibold text-warning">
                                          Borrow: {b.reason || "Staff Borrow"}
                                        </span>
                                        <span className="text-foreground/40 text-[11px] ml-1">
                                          {b.date || "—"}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold text-warning shrink-0">
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

            <ModalFooter className="border-t border-divider py-2">
              <Button
                variant="light"
                radius="sm"
                onPress={onClose}
                className="text-xs sm:text-sm font-medium"
              >
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
