"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Trash2 } from "lucide-react";
import type { StaffAssignmentRecord, StaffMember } from "@/lib/types";
import { PAYMENT_TYPES } from "@/lib/catalog";
import { apiFetch } from "@/lib/api";
import { assignmentMoney, inr, todayLocalISO } from "@/lib/staffPay";

/**
 * Advances given to one staff member for one job.
 *
 * The owner records each amount handed over (date, mode, note); every advance
 * is subtracted from the assignment's amount, and what is left is the "Due".
 * Staff opening their own page see the same list read-only.
 */
export default function StaffPaymentsModal({
  staff,
  assignment,
  isOwner,
  onClose,
  onChanged,
}: {
  staff: StaffMember;
  /** The assignment to show. `null` keeps the modal closed. */
  assignment: StaffAssignmentRecord | null;
  isOwner: boolean;
  onClose: () => void;
  /** Called after a payment is added/removed so the parent re-fetches the fresh data. */
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [mode, setMode] = useState<string>(PAYMENT_TYPES[1] ?? "Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Start every opening with a clean form.
  const orderId = assignment?.orderId;
  useEffect(() => {
    setAmount("");
    setDate(todayLocalISO());
    setNote("");
    setError("");
  }, [orderId]);

  if (!assignment) return null;

  const money = assignmentMoney(assignment);
  const payments = assignment.payments ?? [];
  const canAdd = isOwner && money.status === "due" && money.total > 0 && money.due > 0;
  const base = `/api/staff/${encodeURIComponent(staff.id)}/assignments/${encodeURIComponent(assignment.orderId)}/payments`;

  async function addPayment(): Promise<void> {
    const value = parseFloat(amount);
    if (!(value > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (value > money.due + 0.005) {
      setError(`That is more than the remaining due (${inr(money.due)}).`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, date, mode, note }),
      });
      if (res.ok) {
        setAmount("");
        setNote("");
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not record the payment.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removePayment(id: string, value: string): Promise<void> {
    if (!confirm(`Delete this ${inr(parseFloat(value) || 0)} payment record?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        onChanged();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not delete the payment.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} size="lg" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5" style={{ fontFamily: "var(--font-display)" }}>
              <span>
                {staff.name} — advances
              </span>
              <span className="text-xs font-normal text-foreground/50">
                {assignment.orderId} &middot; {assignment.customerName || "—"}
                {assignment.program ? ` · ${assignment.program}` : ""}
              </span>
            </ModalHeader>

            <ModalBody className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-content2 rounded-md py-2">
                  <p className="text-xs text-foreground/50">Amount</p>
                  <p className="font-semibold">{inr(money.total)}</p>
                </div>
                <div className="bg-content2 rounded-md py-2">
                  <p className="text-xs text-foreground/50">Advances given</p>
                  <p className="font-semibold text-success">{inr(money.advances)}</p>
                </div>
                <div className="bg-content2 rounded-md py-2">
                  <p className="text-xs text-foreground/50">Due</p>
                  <p className="font-semibold text-warning">{inr(money.due)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Chip size="sm" variant="flat" color={money.status === "paid" ? "success" : "warning"}>
                  {money.status === "paid" ? "Paid" : "Due"}
                </Chip>
                {money.status === "paid" && (
                  <span className="text-xs text-foreground/50">Fully settled — nothing more is owed for this job.</span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Payments recorded</p>
                {payments.length === 0 ? (
                  <p className="text-sm text-foreground/50">No advance has been recorded for this job yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 bg-content2 rounded-md px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{inr(parseFloat(p.amount) || 0)}</span>
                            <span className="text-foreground/50">
                              {" "}
                              &middot; {p.date} &middot; {p.mode}
                            </span>
                          </p>
                          {p.note && <p className="text-xs text-foreground/60 break-words">{p.note}</p>}
                        </div>
                        {isOwner && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            radius="sm"
                            isDisabled={busy}
                            onPress={() => removePayment(p.id, p.amount)}
                            aria-label="Delete payment"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isOwner && canAdd && (
                <div className="border-t border-content3 pt-4 space-y-3">
                  <p className="text-sm font-semibold">Record an advance</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      label="Amount (₹)"
                      variant="bordered"
                      inputMode="decimal"
                      value={amount}
                      onValueChange={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
                      description={
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => setAmount(String(money.due))}
                        >
                          Fill full due ({inr(money.due)})
                        </button>
                      }
                    />
                    <Input label="Date" type="date" variant="bordered" value={date} onValueChange={setDate} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TYPES.map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        radius="full"
                        variant={mode === t ? "solid" : "bordered"}
                        color={mode === t ? "secondary" : "default"}
                        onPress={() => setMode(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                  <Input
                    label="Note (optional)"
                    placeholder="e.g. travel money, given at the shop"
                    variant="bordered"
                    value={note}
                    onValueChange={setNote}
                    maxLength={200}
                  />
                  <Button color="primary" radius="sm" className="font-semibold" isLoading={busy} onPress={addPayment}>
                    Add payment
                  </Button>
                </div>
              )}

              {isOwner && !canAdd && (
                <p className="text-xs text-foreground/50 border-t border-content3 pt-3">
                  {money.total <= 0
                    ? "Set this staff member's amount first (Edit on the assignments page), then you can record advances."
                    : money.status === "paid"
                      ? "This job is marked Paid. To record another advance, set it back to Due with Edit."
                      : "Nothing left to pay — the advances cover the full amount."}
                </p>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}
            </ModalBody>

            <ModalFooter>
              <Button variant="bordered" radius="sm" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}