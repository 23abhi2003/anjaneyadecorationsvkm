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
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import {
  Wallet,
  Calendar,
  MapPin,
  User,
  Tag,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { COMMON_RIDE_REASONS } from "@/components/autorides/RideWizard";
import type { AutoRide, AutoDriver } from "@/lib/types";

interface QuickAddRideModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  baseRide: AutoRide | null;
  drivers: AutoDriver[];
  personRideCount?: number;
  onSuccess: () => void;
}

export default function QuickAddRideModal({
  isOpen,
  onOpenChange,
  baseRide,
  drivers = [],
  personRideCount = 1,
  onSuccess,
}: QuickAddRideModalProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "due">("paid");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");
  const [driverAssigned, setDriverAssigned] = useState("Unassigned");
  const [driverPay, setDriverPay] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (baseRide && isOpen) {
      setTotalAmount("");
      setAdvancePaid("");
      setPaymentStatus("paid");
      setDate(new Date().toISOString().slice(0, 10));
      setReason(baseRide.reason || "");
      setPickupLocation(baseRide.pickupLocation || "");
      setDropLocation(baseRide.dropLocation || "");
      setDriverAssigned(baseRide.driverAssigned || "Unassigned");
      setDriverPay("");
      setError("");
    }
  }, [baseRide, isOpen]);

  const total = parseFloat(totalAmount) || 0;
  const advance = parseFloat(advancePaid) || 0;
  const due = Math.max(total - advance, 0);

  function handleTotalChange(val: string) {
    setTotalAmount(val);
    const tot = parseFloat(val) || 0;
    const adv = parseFloat(advancePaid) || 0;
    const calcDue = Math.max(tot - adv, 0);
    setPaymentStatus(calcDue <= 0 && tot > 0 ? "paid" : "due");
  }

  function handleAdvanceChange(val: string) {
    setAdvancePaid(val);
    const adv = parseFloat(val) || 0;
    const tot = parseFloat(totalAmount) || 0;
    const calcDue = Math.max(tot - adv, 0);
    setPaymentStatus(calcDue <= 0 && tot > 0 ? "paid" : "due");
  }

  function fillFullAdvance() {
    if (total > 0) {
      setAdvancePaid(String(total));
      setPaymentStatus("paid");
    }
  }

  async function handleSave() {
    if (!baseRide) return;
    if (!totalAmount.trim() || Number.isNaN(parseFloat(totalAmount))) {
      setError("Please enter the fare amount for this ride.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Partial<AutoRide> = {
        customerName: baseRide.customerName,
        customerPhone: baseRide.customerPhone || "",
        reason: reason.trim(),
        pickupLocation: pickupLocation.trim(),
        dropLocation: dropLocation.trim(),
        date: date.trim() || new Date().toISOString().slice(0, 10),
        driverAssigned: driverAssigned.trim() || "Unassigned",
        totalAmount: String(total),
        advancePaid: String(advance),
        dueAmount: String(due),
        driverPay: driverPay.trim() || "0",
        status: "completed",
        paymentStatus,
      };

      const res = await apiFetch("/api/auto-rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record ride");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ride. Please check connection.");
    } finally {
      setSaving(false);
    }
  }

  if (!baseRide) return null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      placement="center"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-[#241129] border-b border-primary/25 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary/20 text-[#241129]">
                  <Plus size={18} strokeWidth={3} />
                </span>
                <div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Add Ride for {baseRide.customerName}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono font-normal">
                    Adding Ride #{personRideCount + 1} for this customer
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-lg font-medium">
                  {error}
                </div>
              )}

              {/* Customer & Route Quick Info */}
              <div className="p-3 rounded-xl bg-[#F8F4E6] border border-primary/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#241129] flex items-center gap-1.5 text-sm">
                    <User size={14} className="text-primary" />
                    {baseRide.customerName}
                  </span>
                  {baseRide.customerPhone && (
                    <span className="font-mono text-gray-500">{baseRide.customerPhone}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                  <MapPin size={12} className="text-[#3F6B1F] shrink-0" />
                  <span>
                    {pickupLocation || "Pickup"} {pickupLocation && dropLocation ? "→" : ""} {dropLocation || ""}
                  </span>
                </div>
              </div>

              {/* CORE INPUT: Ask for Amount (Photo 1 & user request) */}
              <div className="p-4 rounded-xl bg-white border-2 border-primary/40 shadow-sm space-y-3">
                <label className="text-sm font-bold text-[#241129] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wallet size={16} className="text-primary" />
                    Enter Amount (₹): *
                  </span>
                  <span className="text-xs font-mono text-primary font-bold">Fare</span>
                </label>

                <Input
                  type="number"
                  placeholder="Enter amount (e.g. 200, 500)..."
                  value={totalAmount}
                  onValueChange={handleTotalChange}
                  autoFocus
                  isRequired
                  variant="bordered"
                  radius="sm"
                  size="lg"
                  startContent={<span className="text-lg font-bold font-mono text-primary">₹</span>}
                />

                {/* Quick preset chips for rapid 1-tap entry */}
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 150, 200, 300, 400, 500, 800, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleTotalChange(String(amt))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        totalAmount === String(amt)
                          ? "bg-primary text-[#241129] shadow-sm"
                          : "bg-[#F3ECD8] text-[#241129] hover:bg-primary/20 border border-primary/20"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                {/* Advance and Due calculation */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <Input
                      type="number"
                      label="Advance Paid (₹)"
                      placeholder="0"
                      value={advancePaid}
                      onValueChange={handleAdvanceChange}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<span className="text-xs font-mono font-bold text-success">₹</span>}
                    />
                    {total > 0 && advance < total && (
                      <button
                        type="button"
                        onClick={fillFullAdvance}
                        className="text-[11px] text-primary hover:underline font-mono font-semibold mt-1 block"
                      >
                        Mark fully paid (₹{total})
                      </button>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#F3ECD8] border border-primary/30 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-mono font-bold text-gray-500">
                      Due: (Total - Adv)
                    </span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        due > 0 ? "text-[#8B4A15]" : "text-success"
                      }`}
                    >
                      ₹{due.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Select
                    label="Payment Status"
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    selectedKeys={[paymentStatus]}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as "paid" | "due";
                      if (val) setPaymentStatus(val);
                    }}
                  >
                    <SelectItem key="paid" textValue="Paid in Full">Paid in Full</SelectItem>
                    <SelectItem key="due" textValue="Payment Due">Payment Due</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Date & Reason & Route details */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    label="Date:"
                    value={date}
                    onValueChange={setDate}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    startContent={<Calendar size={14} className="text-primary" />}
                  />

                  <Select
                    label="Pilot / Driver:"
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    selectedKeys={[driverAssigned]}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as string;
                      if (val) setDriverAssigned(val);
                    }}
                  >
                    {[
                      <SelectItem key="Unassigned" textValue="Unassigned">-- Unassigned --</SelectItem>,
                      ...drivers.map((d) => (
                        <SelectItem key={d.name} textValue={d.name}>{d.name}</SelectItem>
                      )),
                    ]}
                  </Select>
                </div>

                <div>
                  <Input
                    label="Reason / Purpose:"
                    placeholder="e.g. Marriage, Hospital, Goods..."
                    value={reason}
                    onValueChange={setReason}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    startContent={<Tag size={14} className="text-primary" />}
                  />
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {COMMON_RIDE_REASONS.slice(0, 4).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          reason === r
                            ? "bg-primary text-[#241129] font-bold"
                            : "bg-[#F3ECD8] text-[#241129]/80 hover:bg-primary/20"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Route points (prefilled, editable) */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Input
                    label="From:"
                    placeholder="Pickup location"
                    value={pickupLocation}
                    onValueChange={setPickupLocation}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                  />
                  <Input
                    label="To:"
                    placeholder="Drop destination"
                    value={dropLocation}
                    onValueChange={setDropLocation}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                  />
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-primary/25 pt-3">
              <Button
                variant="light"
                radius="sm"
                onPress={onClose}
                className="font-semibold text-gray-500"
              >
                Cancel
              </Button>
              <Button
                color="primary"
                radius="sm"
                onPress={handleSave}
                isLoading={saving}
                className="font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90 px-6"
                startContent={!saving && <CheckCircle2 size={16} />}
              >
                Save Ride (₹{total || 0})
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
