"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Chip, Input } from "@heroui/react";
import { Trash2, Pencil, Check, X, Calendar, Receipt, CheckCircle2 } from "lucide-react";
import type { StaffBorrow, StaffBorrowStatus, StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { inr, nextSettlementNumber, parseAmt, staffBalance, todayLocalISO } from "@/lib/staffPay";

interface BorrowEditState {
  amount: string;
  date: string;
  reason: string;
  paymentStatus: StaffBorrowStatus;
  settlementNumber?: string;
}

/**
 * Money a staff member borrowed from the owner, each with a date, a reason,
 * and a status: "due", "paid", or "settled".
 *
 *   Remaining = total of ALL their assigned orders - borrows still DUE
 *
 * A borrow marked "paid" means the staff member repaid it in cash (outside
 * payroll) — it's excluded from remaining.
 * A borrow marked "settled" means it was cleared in a settlement batch (#settlementNumber).
 *
 * Owner: sees the summary, the list, and can add / edit / delete / settle borrows.
 * Staff logins only ever see it in read-only mode.
 */
export default function StaffBorrowsPanel({
  staff,
  isOwner,
  onChanged,
}: {
  staff: StaffMember;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const suggestedSettlementNum = useMemo(() => nextSettlementNumber(staff), [staff]);

  // Add form state
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState<StaffBorrowStatus>("due");
  const [newSettlementNum, setNewSettlementNum] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Owner-only inline editing, one borrow at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<BorrowEditState>({
    amount: "",
    date: "",
    reason: "",
    paymentStatus: "due",
    settlementNumber: "",
  });
  const [rowError, setRowError] = useState("");

  const balance = staffBalance(staff.assignments, staff.borrows);
  const overBorrowed = balance.remaining < 0;

  // Active borrows: only borrows that are NOT settled (settled borrows are moved to settlements page)
  const activeBorrows = useMemo(
    () =>
      [...(staff.borrows ?? [])]
        .filter((b) => b.paymentStatus !== "settled" && (!b.settlementNumber || Number(b.settlementNumber) <= 0))
        .sort(
          (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
        ),
    [staff.borrows]
  );

  // Settled borrows that have been cleared in settlement batches
  const settledBorrows = useMemo(
    () =>
      [...(staff.borrows ?? [])]
        .filter((b) => b.paymentStatus === "settled" || (b.settlementNumber != null && Number(b.settlementNumber) > 0))
        .sort(
          (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
        ),
    [staff.borrows]
  );

  const totalSettledBorrowsAmt = useMemo(
    () => settledBorrows.reduce((sum, b) => sum + parseAmt(b.amount), 0),
    [settledBorrows]
  );

  const base = `/api/staff/${encodeURIComponent(staff.id)}/borrows`;

  async function addBorrow(): Promise<void> {
    if (!isOwner) return;
    if (!(parseFloat(amount) > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason for the borrow.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: {
        amount: string;
        date: string;
        reason: string;
        paymentStatus: StaffBorrowStatus;
        settlementNumber?: number;
      } = {
        amount,
        date,
        reason: reason.trim(),
        paymentStatus: newStatus,
      };

      if (newStatus === "settled") {
        const num = parseInt(newSettlementNum || String(suggestedSettlementNum), 10);
        if (num > 0) payload.settlementNumber = num;
      }

      const res = await apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAmount("");
        setReason("");
        setDate(todayLocalISO());
        setNewStatus("due");
        setNewSettlementNum("");
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not record the borrow.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(b: StaffBorrow): void {
    if (!isOwner) return;
    setEditingId(b.id);
    const st: StaffBorrowStatus =
      b.paymentStatus === "paid" ? "paid" : b.paymentStatus === "settled" ? "settled" : "due";
    setEditState({
      amount: b.amount || "",
      date: b.date || "",
      reason: b.reason || "",
      paymentStatus: st,
      settlementNumber: b.settlementNumber ? String(b.settlementNumber) : String(suggestedSettlementNum),
    });
    setRowError("");
  }

  function cancelEdit(): void {
    setEditingId(null);
    setRowError("");
  }

  async function saveEdit(id: string): Promise<void> {
    if (!isOwner) return;
    if (!(parseFloat(editState.amount) > 0)) {
      setRowError("Enter an amount greater than 0.");
      return;
    }
    if (!editState.reason.trim()) {
      setRowError("Enter a reason for the borrow.");
      return;
    }
    setBusy(true);
    setRowError("");
    try {
      const payload: {
        amount: string;
        date: string;
        reason: string;
        paymentStatus: StaffBorrowStatus;
        settlementNumber?: number;
      } = {
        amount: editState.amount,
        date: editState.date,
        reason: editState.reason.trim(),
        paymentStatus: editState.paymentStatus,
      };

      if (editState.paymentStatus === "settled") {
        const num = parseInt(editState.settlementNumber || String(suggestedSettlementNum), 10);
        if (num > 0) payload.settlementNumber = num;
      }

      const res = await apiFetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingId(null);
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(data.error || "Could not save changes.");
      }
    } catch {
      setRowError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Quick cycle between Due -> Paid -> Settled -> Due — owner only. */
  async function toggleStatus(b: StaffBorrow): Promise<void> {
    if (!isOwner) return;
    const current: StaffBorrowStatus =
      b.paymentStatus === "paid" ? "paid" : b.paymentStatus === "settled" ? "settled" : "due";

    const next: StaffBorrowStatus =
      current === "due" ? "paid" : current === "paid" ? "settled" : "due";

    setBusy(true);
    setError("");
    try {
      const payload: { paymentStatus: StaffBorrowStatus; settlementNumber?: number } = {
        paymentStatus: next,
      };

      if (next === "settled") {
        payload.settlementNumber = b.settlementNumber || suggestedSettlementNum;
      }

      const res = await apiFetch(`${base}/${encodeURIComponent(b.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not update the status.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBorrow(id: string, value: string): Promise<void> {
    if (!isOwner) return;
    if (!confirm(`Delete this ${inr(parseAmt(value))} borrow record?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not delete the borrow.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-[11px] text-foreground/50">Total Orders</p>
            <p className="font-semibold text-sm">{inr(balance.total)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-[11px] text-foreground/50">Borrowed (Due)</p>
            <p className="font-semibold text-warning text-sm">{inr(balance.borrowed)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-[11px] text-foreground/50">Repaid (Paid)</p>
            <p className="font-semibold text-success text-sm">{inr(balance.repaid)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-[11px] text-foreground/50">Settled</p>
            <p className="font-semibold text-primary text-sm">{inr(balance.settled)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-foreground/50">Remaining</p>
            <p className={`font-semibold text-sm ${overBorrowed ? "text-danger" : "text-success"}`}>
              {inr(balance.remaining)}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-foreground/40 text-center">
          Remaining = total orders − borrowed still due
        </p>
        {overBorrowed && (
          <p className="text-xs text-danger text-center">
            Borrowed {inr(-balance.remaining)} more than the orders total so far.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-semibold">Active Borrows ({activeBorrows.length})</p>
          {settledBorrows.length > 0 && (
            <span className="text-xs text-primary font-mono font-medium">
              {settledBorrows.length} settled &rarr; settlements page
            </span>
          )}
        </div>
        {activeBorrows.length === 0 ? (
          <p className="text-sm text-foreground/50">
            {settledBorrows.length > 0
              ? "All recorded borrows have been settled and moved to the settlements page."
              : "No active borrow recorded."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {activeBorrows.map((b) => {
              const isEditing = isOwner && editingId === b.id;
              const status: StaffBorrowStatus =
                b.paymentStatus === "paid" ? "paid" : b.paymentStatus === "settled" ? "settled" : "due";

              return (
                <li key={b.id} className="bg-content2 rounded-md px-3 py-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input
                          aria-label="Amount"
                          label="Amount (₹)"
                          size="sm"
                          variant="bordered"
                          inputMode="decimal"
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
                      </div>
                      <Input
                        aria-label="Reason"
                        label="Reason"
                        size="sm"
                        variant="bordered"
                        value={editState.reason}
                        onValueChange={(v) => setEditState({ ...editState, reason: v })}
                        maxLength={200}
                      />

                      <div className="space-y-2 pt-1 border-t border-divider/40">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-foreground/60 mr-1">Status:</span>
                            {(["due", "paid", "settled"] as const).map((st) => (
                              <Button
                                key={st}
                                size="sm"
                                radius="full"
                                variant={editState.paymentStatus === st ? "solid" : "bordered"}
                                color={
                                  editState.paymentStatus === st
                                    ? st === "paid"
                                      ? "success"
                                      : st === "settled"
                                      ? "primary"
                                      : "warning"
                                    : "default"
                                }
                                onPress={() => setEditState({ ...editState, paymentStatus: st })}
                                className="h-7 text-xs capitalize font-medium"
                              >
                                {st}
                              </Button>
                            ))}
                          </div>

                          {editState.paymentStatus === "settled" && (
                            <div className="w-32">
                              <Input
                                label="Settlement #"
                                size="sm"
                                variant="bordered"
                                inputMode="numeric"
                                value={editState.settlementNumber || ""}
                                onValueChange={(v) =>
                                  setEditState({ ...editState, settlementNumber: v.replace(/\D/g, "") })
                                }
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1 pt-1">
                          <Button
                            isIconOnly
                            size="sm"
                            color="primary"
                            radius="sm"
                            isLoading={busy}
                            onPress={() => saveEdit(b.id)}
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
                            isDisabled={busy}
                            aria-label="Cancel"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                      {rowError && <p className="text-xs text-danger">{rowError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{inr(parseAmt(b.amount))}</span>
                          <span className="text-foreground/50">&middot; {b.date}</span>
                          <Chip
                            size="sm"
                            variant="flat"
                            color={status === "paid" ? "success" : status === "settled" ? "primary" : "warning"}
                            className={isOwner ? "cursor-pointer font-medium" : "font-medium"}
                            onClick={isOwner ? () => toggleStatus(b) : undefined}
                            title={isOwner ? "Owner: click to cycle Due → Paid → Settled" : undefined}
                          >
                            {status === "settled"
                              ? `Settled (#${b.settlementNumber || 1})`
                              : status === "paid"
                              ? "Paid"
                              : "Due"}
                          </Chip>
                          {status === "settled" && b.settledAt && (
                            <span className="text-xs text-foreground/40 font-mono">
                              on {b.settledAt}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-foreground/60 wrap-break-word">{b.reason || "—"}</p>
                      </div>
                      {isOwner && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="sm"
                            isDisabled={busy}
                            onPress={() => startEdit(b)}
                            aria-label="Edit borrow"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            radius="sm"
                            isDisabled={busy}
                            onPress={() => removeBorrow(b.id, b.amount)}
                            aria-label="Delete borrow"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {settledBorrows.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 bg-primary/10 border border-primary/30 rounded-lg p-2.5 text-xs text-foreground/80 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary shrink-0" />
              <span>
                <strong className="text-primary font-semibold">{settledBorrows.length} borrow{settledBorrows.length === 1 ? "" : "s"}</strong> ({inr(totalSettledBorrowsAmt)}) settled and moved to settlements page.
              </span>
            </div>
            <Button
              as={Link}
              href={`/settlements/detail?id=${encodeURIComponent(staff.id)}`}
              size="sm"
              variant="flat"
              color="primary"
              radius="sm"
              className="h-6 text-xs px-2.5 font-medium"
            >
              View Borrow Settlements &rarr;
            </Button>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="border-t border-content3 pt-4 space-y-3">
          <p className="text-sm font-semibold">Record a borrow</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Amount (₹)"
              variant="bordered"
              inputMode="decimal"
              value={amount}
              onValueChange={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
            />
            <Input label="Date" type="date" variant="bordered" value={date} onValueChange={setDate} />
          </div>
          <Input
            label="Reason"
            placeholder="e.g. medical emergency, festival advance"
            variant="bordered"
            value={reason}
            onValueChange={setReason}
            maxLength={200}
            isRequired
          />

          {/* Ask for due, paid, settled */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-foreground/60">Status:</span>
            <div className="flex items-center gap-1.5">
              {(["due", "paid", "settled"] as const).map((st) => (
                <Button
                  key={st}
                  size="sm"
                  radius="full"
                  variant={newStatus === st ? "solid" : "bordered"}
                  color={
                    newStatus === st
                      ? st === "paid"
                        ? "success"
                        : st === "settled"
                        ? "primary"
                        : "warning"
                      : "default"
                  }
                  onPress={() => setNewStatus(st)}
                  className="h-7 text-xs capitalize font-medium"
                >
                  {st}
                </Button>
              ))}
            </div>

            {newStatus === "settled" && (
              <div className="w-36">
                <Input
                  label="Settlement #"
                  size="sm"
                  variant="bordered"
                  inputMode="numeric"
                  placeholder={String(suggestedSettlementNum)}
                  value={newSettlementNum}
                  onValueChange={(v) => setNewSettlementNum(v.replace(/\D/g, ""))}
                />
              </div>
            )}
          </div>

          <Button color="primary" radius="sm" className="font-semibold" isLoading={busy} onPress={addBorrow}>
            Add borrow
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
