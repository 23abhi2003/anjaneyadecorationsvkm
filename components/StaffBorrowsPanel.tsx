"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Trash2 } from "lucide-react";
import type { StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { inr, parseAmt, staffBalance, todayLocalISO } from "@/lib/staffPay";

/**
 * Money a staff member borrowed from the owner, each with a date and a reason.
 *
 *   Remaining = total of ALL their assigned orders - everything borrowed
 *
 * The total always covers every assignment (never a date-filtered subset), so it
 * is computed from `staff.assignments` here rather than taken from the page's filter.
 *
 * Owner: sees the summary, the list, and can add / delete borrows.
 * Staff (own page): sees the same total/borrowed/remaining summary and the list,
 * read-only — they just can't add or delete borrows.
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
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Total of all orders</p>
            <p className="font-semibold">{inr(balance.total)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Borrowed</p>
            <p className="font-semibold text-warning">{inr(balance.borrowed)}</p>
          </div>
          <div className="bg-content2 rounded-md py-2 px-1">
            <p className="text-xs text-foreground/50">Remaining</p>
            <p className={`font-semibold ${overBorrowed ? "text-danger" : "text-success"}`}>{inr(balance.remaining)}</p>
          </div>
        </div>
        <p className="text-xs text-foreground/40 text-center">Remaining = total of all orders − borrowed</p>
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
            {borrows.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 bg-content2 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{inr(parseAmt(b.amount))}</span>
                    <span className="text-foreground/50"> &middot; {b.date}</span>
                  </p>
                  <p className="text-xs text-foreground/60 break-words">{b.reason || "—"}</p>
                </div>
                {isOwner && (
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
                )}
              </li>
            ))}
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