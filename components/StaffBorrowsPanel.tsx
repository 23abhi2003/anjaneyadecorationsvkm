"use client";

import { useMemo, useState } from "react";
import { Button, Chip, Input } from "@heroui/react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import type { StaffBorrow, StaffMember, StaffPaymentStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { inr, parseAmt, staffBalance, todayLocalISO } from "@/lib/staffPay";

interface BorrowEditState {
  amount: string;
  date: string;
  reason: string;
  paymentStatus: StaffPaymentStatus;
}

/**
 * Money a staff member borrowed from the owner, each with a date, a reason,
 * and now a repayment status.
 *
 *   Remaining = total of ALL their assigned orders - borrows still DUE
 *
 * A borrow marked "paid" means the staff member repaid it in cash (outside
 * payroll) — it's excluded from the remaining calc but stays in the ledger.
 * The total always covers every assignment (never a date-filtered subset), so it
 * is computed from `staff.assignments` here rather than taken from the page's filter.
 *
 * Owner: sees the summary, the list, and can add / edit / delete borrows —
 * including flipping a borrow between Due and Paid. That status (like the
 * rest of the record) is owner-only; a staff login only ever sees it read-only.
 *
 * Presentational only (no Card/Modal wrapper) so it can sit in a page or a modal.
 * After any change it calls `onChanged` so the parent re-fetches the fresh staff record.
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
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Owner-only inline editing, one borrow at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<BorrowEditState>({ amount: "", date: "", reason: "", paymentStatus: "due" });
  const [rowError, setRowError] = useState("");

  const balance = staffBalance(staff.assignments, staff.borrows);
  const overBorrowed = balance.remaining < 0;

  // Newest first (by the date it was borrowed, then by when it was entered).
  const borrows = useMemo(
    () =>
      [...(staff.borrows ?? [])].sort(
        (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
      ),
    [staff.borrows]
  );

  const base = `/api/staff/${encodeURIComponent(staff.id)}/borrows`;

  async function addBorrow(): Promise<void> {
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
      const res = await apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, date, reason: reason.trim() }),
      });
      if (res.ok) {
        setAmount("");
        setReason("");
        setDate(todayLocalISO());
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
    setEditingId(b.id);
    setEditState({
      amount: b.amount || "",
      date: b.date || "",
      reason: b.reason || "",
      paymentStatus: b.paymentStatus === "paid" ? "paid" : "due",
    });
    setRowError("");
  }

  function cancelEdit(): void {
    setEditingId(null);
    setRowError("");
  }

  async function saveEdit(id: string): Promise<void> {
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
      const res = await apiFetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: editState.amount,
          date: editState.date,
          reason: editState.reason.trim(),
          paymentStatus: editState.paymentStatus,
        }),
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

  /** Quick toggle without opening the full edit row — owner only. */
  async function toggleStatus(b: StaffBorrow): Promise<void> {
    const next: StaffPaymentStatus = b.paymentStatus === "paid" ? "due" : "paid";
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`${base}/${encodeURIComponent(b.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
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
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Total of all orders</p>
            <p className="font-semibold">{inr(balance.total)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Borrowed (due)</p>
            <p className="font-semibold text-warning">{inr(balance.borrowed)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Repaid</p>
            <p className="font-semibold text-success">{inr(balance.repaid)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Remaining</p>
            <p className={`font-semibold ${overBorrowed ? "text-danger" : "text-success"}`}>{inr(balance.remaining)}</p>
          </div>
        </div>
        <p className="text-xs text-foreground/40 text-center">Remaining = total of all orders − borrowed still due</p>
        {overBorrowed && (
          <p className="text-xs text-danger text-center">
            Borrowed {inr(-balance.remaining)} more than the orders total so far.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Borrows recorded</p>
        {borrows.length === 0 ? (
          <p className="text-sm text-foreground/50">No borrow has been recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {borrows.map((b) => {
              const isEditing = isOwner && editingId === b.id;
              const status: StaffPaymentStatus = b.paymentStatus === "paid" ? "paid" : "due";
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
                      <div className="flex items-center justify-between gap-2 flex-wrap">
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
                        <div className="flex items-center gap-1">
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
                            color={status === "paid" ? "success" : "warning"}
                            className={isOwner ? "cursor-pointer" : ""}
                            onClick={isOwner ? () => toggleStatus(b) : undefined}
                            title={isOwner ? "Click to toggle Due / Paid" : undefined}
                          >
                            {status === "paid" ? "Paid" : "Due"}
                          </Chip>
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
          <Button color="primary" radius="sm" className="font-semibold" isLoading={busy} onPress={addBorrow}>
            Add borrow
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}