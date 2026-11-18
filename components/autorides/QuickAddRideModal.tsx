"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
} from "@heroui/react";
import {
  Wallet,
  Calendar,
  CheckCircle2,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Tag,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AutoRide } from "@/lib/types";

interface QuickAddRideModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  baseRide: AutoRide | null;
  mode?: "add" | "reduce";
  onSuccess: () => void;
}

const AMOUNT_PRESETS = [100, 200, 300, 500, 1000];

export default function QuickAddRideModal({
  isOpen,
  onOpenChange,
  baseRide,
  mode = "add",
  onSuccess,
}: QuickAddRideModalProps) {
  const isReduce = mode === "reduce";

  const currentCount = Number(baseRide?.rideCount) || 1;
  const currentTotal = parseFloat(baseRide?.totalAmount || "0") || 0;
  const currentAdvance = parseFloat(baseRide?.advancePaid || "0") || 0;
  const currentDue = parseFloat(baseRide?.dueAmount || "0") || 0;
  const suggestedAmount = Math.max(Math.round(currentTotal / currentCount), 100) || 500;

  // Form states
  const [amountInput, setAmountInput] = useState<string>("");
  const [isPaidNow, setIsPaidNow] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (baseRide && isOpen) {
      setAmountInput(String(suggestedAmount));
      // If the current ride was already fully paid, default to collecting payment now as well
      setIsPaidNow(currentDue <= 0 && currentTotal > 0);
      setReason("");
      setError("");
    }
  }, [baseRide, isOpen, suggestedAmount, currentDue, currentTotal]);

  const enteredAmount = Math.max(parseFloat(amountInput) || 0, 0);

  // Computed values for "add" mode
  const newCountAdd = currentCount + 1;
  const newTotalAdd = currentTotal + enteredAmount;
  const newAdvanceAdd = currentAdvance + (isPaidNow ? enteredAmount : 0);
  const newDueAdd = Math.max(newTotalAdd - newAdvanceAdd, 0);

  // Computed values for "reduce" mode
  const newCountReduce = Math.max(currentCount - 1, 1);
  const newTotalReduce = Math.max(currentTotal - enteredAmount, 0);
  const newAdvanceReduce = Math.min(currentAdvance, newTotalReduce);
  const newDueReduce = Math.max(newTotalReduce - newAdvanceReduce, 0);

  async function handleSave() {
    if (!baseRide) return;
    if (enteredAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const today = new Date().toISOString().slice(0, 10);
      let payload: Partial<AutoRide>;

      if (isReduce) {
        const noteLine = `[Removed 1 Ride on ${today}]: -₹${enteredAmount}`;
        const updatedNotes = baseRide.notes ? `${baseRide.notes}\n${noteLine}` : noteLine;

        payload = {
          rideCount: newCountReduce,
          totalAmount: String(newTotalReduce),
          advancePaid: String(newAdvanceReduce),
          dueAmount: String(newDueReduce),
          paymentStatus: newDueReduce <= 0 ? "paid" : "due",
          notes: updatedNotes,
        };
      } else {
        const noteLine = `[Ride ${newCountAdd} on ${today}]: +₹${enteredAmount}${
          reason.trim() ? ` (${reason.trim()})` : ""
        } — ${isPaidNow ? "Paid" : "Pending Due"}`;
        const updatedNotes = baseRide.notes ? `${baseRide.notes}\n${noteLine}` : noteLine;

        payload = {
          rideCount: newCountAdd,
          totalAmount: String(newTotalAdd),
          advancePaid: String(newAdvanceAdd),
          dueAmount: String(newDueAdd),
          paymentStatus: newDueAdd <= 0 ? "paid" : "due",
          notes: updatedNotes,
        };
      }

      const res = await apiFetch(`/api/auto-rides/${baseRide.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update ride");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update ride. Please check connection.");
    } finally {
      setSaving(false);
    }
  }

  if (!baseRide) return null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      size="md"
      classNames={{
        base: "bg-white border border-[#D9A427]/40 shadow-2xl rounded-2xl mx-3",
        header: "border-b border-gray-100 pb-3",
        footer: "border-t border-gray-100 pt-3",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base shadow-sm ${
                  isReduce
                    ? "bg-danger-100 text-danger"
                    : "bg-[#D9A427]/20 text-[#241129] border border-[#D9A427]/40"
                }`}
              >
                {isReduce ? <Minus size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#241129]">
                    {isReduce ? "Reduce Ride Count" : "Add Ride to Existing Booking"}
                  </h2>
                  <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                    {baseRide.id}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  Customer: <span className="font-semibold text-gray-800">{baseRide.customerName}</span>
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4 text-[#241129]">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 text-danger-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Status Banner */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-mono tracking-wider">Current</span>
                  <span className="font-bold text-sm text-[#241129]">
                    {currentCount} {currentCount === 1 ? "Ride" : "Rides"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono tracking-wider">Total / Due</span>
                  <span className="font-mono font-bold text-sm text-[#241129]">
                    ₹{currentTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="ml-1 text-[11px] font-mono text-warning-700">
                    (Due: ₹{currentDue.toLocaleString("en-IN")})
                  </span>
                </div>
              </div>

              {/* Amount to Add / Deduct */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  {isReduce ? "Amount to Deduct (₹)" : "Amount to Add for this Extra Ride (₹)"}
                </label>
                <Input
                  type="number"
                  variant="bordered"
                  radius="sm"
                  placeholder="e.g. 500"
                  value={amountInput}
                  onValueChange={(val) => {
                    setAmountInput(val);
                    setError("");
                  }}
                  startContent={<span className="text-gray-400 font-bold text-sm">₹</span>}
                  className="font-mono text-base"
                  autoFocus
                />

                {/* Amount Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 font-medium mr-1">Presets:</span>
                  {AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(String(amt))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                        enteredAmount === amt
                          ? "bg-[#241129] text-white shadow-xs"
                          : "bg-gray-100 hover:bg-[#D9A427]/20 text-gray-700 border border-gray-200"
                      }`}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {!isReduce && (
                <>
                  {/* Payment Status Switcher for this added ride */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-gray-700 block">
                      Payment Status for this Ride
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPaidNow(false)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          !isPaidNow
                            ? "bg-warning-50 border-warning-400 text-warning-900 font-bold ring-1 ring-warning-400"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          <span>Pending (Due)</span>
                          {!isPaidNow && <CheckCircle2 size={13} className="text-warning-600" />}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">Adds ₹{enteredAmount} to Due</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPaidNow(true)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isPaidNow
                            ? "bg-success-50 border-success-400 text-success-900 font-bold ring-1 ring-success-400"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          <span>Paid Now</span>
                          {isPaidNow && <CheckCircle2 size={13} className="text-success-600" />}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">Collected ₹{enteredAmount}</p>
                      </button>
                    </div>
                  </div>

                  {/* Optional Reason / Destination Note for this trip */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 block">
                      Trip Note / Reason (Optional)
                    </label>
                    <Input
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      placeholder="e.g. 2nd round trip, Return, Hospital, etc."
                      value={reason}
                      onValueChange={setReason}
                    />
                  </div>
                </>
              )}

              {/* New Resulting Summary Box */}
              <div className="p-3 rounded-xl bg-[#241129]/5 border border-[#241129]/15 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block font-bold">
                  New Result after {isReduce ? "Deduction" : "Adding Ride"}:
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Total Rides for this Booking:</span>
                  <span className="font-mono font-bold text-sm text-[#5B2674]">
                    {isReduce ? newCountReduce : newCountAdd} { (isReduce ? newCountReduce : newCountAdd) === 1 ? "Ride" : "Rides" }
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Updated Total Fare:</span>
                  <span className="font-mono font-bold text-base text-[#241129]">
                    ₹{(isReduce ? newTotalReduce : newTotalAdd).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/60">
                  <span className="text-gray-600">Updated Due Amount:</span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      (isReduce ? newDueReduce : newDueAdd) <= 0 ? "text-success" : "text-warning-800"
                    }`}
                  >
                    {(isReduce ? newDueReduce : newDueAdd) <= 0
                      ? "Fully Paid (₹0 Due)"
                      : `₹${(isReduce ? newDueReduce : newDueAdd).toLocaleString("en-IN")} Due`}
                  </span>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between gap-2">
              <Button variant="light" size="sm" onPress={onClose} disabled={saving} className="text-gray-600">
                Cancel
              </Button>
              <Button
                size="sm"
                onPress={handleSave}
                isLoading={saving}
                className={`font-bold px-4 shadow-sm ${
                  isReduce
                    ? "bg-danger text-white"
                    : "bg-[#D9A427] hover:bg-[#D9A427]/90 text-[#241129]"
                }`}
              >
                {isReduce
                  ? `Confirm & Deduct (-₹${enteredAmount})`
                  : `Save & Add Ride (+₹${enteredAmount})`}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
