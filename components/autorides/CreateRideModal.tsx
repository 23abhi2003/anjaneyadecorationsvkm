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
  Textarea,
  Select,
  SelectItem,
  Card,
  CardBody,
  Chip,
} from "@heroui/react";
import {
  MapPin,
  Phone,
  User,
  Calendar,
  DollarSign,
  Car,
  Wallet,
  Navigation,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { AutoRide, AutoDriver, Customer } from "@/lib/types";
import { apiFetch } from "@/lib/api";

const PICKUP_PRESETS = [
  "VKM Bus Stand",
  "VKM Railway Station",
  "Main Bazaar",
  "Shivalayam",
  "Anjaneya Temple",
  "Govt Hospital",
  "RTC Complex",
];

interface CreateRideModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (ride: AutoRide) => void;
  editRide?: AutoRide | null;
  drivers: AutoDriver[];
  existingCustomers?: Customer[];
}

export default function CreateRideModal({
  isOpen,
  onOpenChange,
  onSuccess,
  editRide,
  drivers,
  existingCustomers = [],
}: CreateRideModalProps) {
  const isEditing = Boolean(editRide);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [driverAssigned, setDriverAssigned] = useState("Unassigned");
  const [totalAmount, setTotalAmount] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [driverPay, setDriverPay] = useState("");
  const [status, setStatus] = useState<"completed" | "scheduled" | "cancelled">("completed");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "due">("paid");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<Customer[]>([]);

  useEffect(() => {
    if (editRide) {
      setCustomerName(editRide.customerName || "");
      setCustomerPhone(editRide.customerPhone || "");
      setPickupLocation(editRide.pickupLocation || "");
      setDropLocation(editRide.dropLocation || "");
      setDate(editRide.date || new Date().toISOString().slice(0, 10));
      setDriverAssigned(editRide.driverAssigned || "Unassigned");
      setTotalAmount(editRide.totalAmount || "");
      setAdvancePaid(editRide.advancePaid || "");
      setDriverPay(editRide.driverPay || "");
      setStatus(editRide.status || "completed");
      setPaymentStatus(editRide.paymentStatus || "paid");
      setNotes(editRide.notes || "");
    } else {
      setCustomerName("");
      setCustomerPhone("");
      setPickupLocation("");
      setDropLocation("");
      setDate(new Date().toISOString().slice(0, 10));
      setDriverAssigned(drivers[0]?.name || "Unassigned");
      setTotalAmount("");
      setAdvancePaid("");
      setDriverPay("");
      setStatus("completed");
      setPaymentStatus("paid");
      setNotes("");
    }
    setError("");
  }, [editRide, isOpen, drivers]);

  function handleNameChange(val: string) {
    setCustomerName(val);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase();
      const matches = existingCustomers.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
      );
      setSuggestions(matches.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }

  function selectCustomer(cust: Customer) {
    setCustomerName(cust.name || "");
    if (cust.phone) setCustomerPhone(cust.phone);
    setSuggestions([]);
  }

  const total = parseFloat(totalAmount) || 0;
  const advance = parseFloat(advancePaid) || 0;
  const due = Math.max(total - advance, 0);
  const pilotWage = parseFloat(driverPay) || 0;
  const estProfit = total - pilotWage;

  function handleTotalChange(val: string) {
    setTotalAmount(val);
    const tot = parseFloat(val) || 0;
    const adv = parseFloat(advancePaid) || 0;
    setPaymentStatus(tot > 0 && tot <= adv ? "paid" : "due");
  }

  function handleAdvanceChange(val: string) {
    setAdvancePaid(val);
    const adv = parseFloat(val) || 0;
    const tot = parseFloat(totalAmount) || 0;
    if (tot > 0 && adv >= tot) {
      setPaymentStatus("paid");
    } else {
      setPaymentStatus("due");
    }
  }

  function fillFullAdvance() {
    if (total > 0) {
      setAdvancePaid(String(total));
      setPaymentStatus("paid");
    }
  }

  async function handleSave() {
    if (!customerName.trim()) {
      setError("Please enter the passenger name.");
      return;
    }
    if (!totalAmount.trim() || Number.isNaN(parseFloat(totalAmount))) {
      setError("Please enter a valid total fare amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Partial<AutoRide> = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupLocation: pickupLocation.trim(),
        dropLocation: dropLocation.trim(),
        date: date.trim(),
        driverAssigned: driverAssigned.trim() || "Unassigned",
        totalAmount: String(total),
        advancePaid: String(advance),
        dueAmount: String(due),
        driverPay: String(pilotWage),
        status,
        paymentStatus,
        notes: notes.trim(),
      };

      const url = isEditing && editRide ? `/api/auto-rides/${editRide.id}` : "/api/auto-rides";
      const method = isEditing ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save ride booking");
      }

      const saved = (await res.json()) as AutoRide;
      onSuccess(saved);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Could not save ride booking.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-[#F8F4E6] border-2 border-[#D9A427]/50 text-[#241129] shadow-2xl rounded-2xl",
        header: "border-b border-[#D9A427]/30 pb-4 bg-[#F8F4E6]",
        footer: "border-t border-[#D9A427]/30 pt-4 bg-[#F8F4E6]",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-primary/20 text-[#241129] border border-primary/40 shadow-sm">
                  <Car size={26} />
                </span>
                <div>
                  <h2 className="text-2xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                    {isEditing ? `Edit Ride Booking (${editRide?.id})` : "Create Auto Ride Booking"}
                  </h2>
                  <p className="text-xs text-[#3F6B1F] font-semibold tracking-wider uppercase font-mono">
                    Anjaneya Auto Rentals · V.K.M
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-5 space-y-5">
              {error && (
                <div className="p-3.5 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}

              {/* Passenger Card */}
              <Card className="bg-content1 border border-[#D9A427]/35 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <User size={15} className="text-primary" />
                      Passenger Information
                    </span>
                    <Chip size="sm" variant="flat" color="primary" className="text-[10px] font-mono font-bold uppercase">
                      Directory Auto-Link
                    </Chip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative">
                    <div>
                      <Input
                        label="Passenger Name"
                        value={customerName}
                        onValueChange={handleNameChange}
                        isRequired
                        variant="bordered"
                        radius="sm"
                        size="sm"
                        startContent={<User size={16} className="text-primary" />}
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-[#D9A427]/40 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-100">
                          {suggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-primary/10 flex justify-between items-center transition-colors"
                            >
                              <span className="font-semibold text-[#241129] flex items-center gap-1.5">
                                <Sparkles size={12} className="text-primary" />
                                {c.name}
                              </span>
                              <span className="text-xs text-[#241129] font-mono font-medium">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Input
                      label="Passenger Phone Number"
                      value={customerPhone}
                      onValueChange={setCustomerPhone}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<Phone size={16} className="text-primary" />}
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Trip & Route Card */}
              <Card className="bg-content1 border border-[#D9A427]/35 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <Navigation size={15} className="text-[#3F6B1F]" />
                      Route &amp; Assignment
                    </span>
                    <Chip size="sm" variant="flat" color="success" className="text-[10px] font-mono font-bold uppercase">
                      V.K.M Municipal Area
                    </Chip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <Input
                        label="Pickup Location"
                        value={pickupLocation}
                        onValueChange={setPickupLocation}
                        variant="bordered"
                        radius="sm"
                        size="sm"
                        startContent={<MapPin size={16} className="text-[#3F6B1F]" />}
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PICKUP_PRESETS.slice(0, 4).map((preset) => (
                          <Chip
                            key={preset}
                            size="sm"
                            variant="flat"
                            color="success"
                            className="cursor-pointer hover:opacity-80 transition-opacity font-mono text-[10px]"
                            onClick={() => setPickupLocation(preset)}
                          >
                            {preset}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Input
                        label="Destination (Drop)"
                        value={dropLocation}
                        onValueChange={setDropLocation}
                        variant="bordered"
                        radius="sm"
                        size="sm"
                        startContent={<MapPin size={16} className="text-[#6E1F3A]" />}
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PICKUP_PRESETS.slice(4).map((preset) => (
                          <Chip
                            key={preset}
                            size="sm"
                            variant="flat"
                            color="danger"
                            className="cursor-pointer hover:opacity-80 transition-opacity font-mono text-[10px]"
                            onClick={() => setDropLocation(preset)}
                          >
                            {preset}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(pickupLocation || dropLocation) && (
                    <div className="p-2.5 rounded-lg bg-[#F8F4E6] border border-[#D9A427]/30 flex items-center gap-2 text-xs font-mono text-[#241129]">
                      <span className="font-semibold text-[#3F6B1F] truncate">{pickupLocation || "Pickup Point"}</span>
                      <ArrowRight size={14} className="text-primary shrink-0" />
                      <span className="font-semibold text-[#6E1F3A] truncate">{dropLocation || "Drop Point"}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <Input
                      type="date"
                      label="Trip Date"
                      value={date}
                      onValueChange={setDate}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<Calendar size={16} className="text-primary" />}
                    />

                    {/* HeroUI Select for Assigned Driver */}
                    <Select
                      label="Assigned Pilot"
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      selectedKeys={[driverAssigned]}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string;
                        if (val) setDriverAssigned(val);
                      }}
                      className="w-full"
                    >
                      {[
                        <SelectItem key="Unassigned" textValue="Unassigned">
                          -- Unassigned --
                        </SelectItem>,
                        ...drivers.map((d) => (
                          <SelectItem key={d.name} textValue={`${d.name} (${d.phone})`}>
                            {d.name} {d.phone ? `(${d.phone})` : ""}
                          </SelectItem>
                        )),
                      ]}
                    </Select>
                  </div>
                </CardBody>
              </Card>

              {/* Fare & Wage Card */}
              <Card className="bg-content1 border border-[#D9A427]/35 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <Wallet size={15} className="text-primary" />
                      Fare, Settlement &amp; Pilot Wage
                    </span>
                    <span className="text-[11px] font-mono text-[#241129] font-semibold">Rupees (₹)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <Input
                      type="number"
                      label="Total Fare Amount (₹)"
                      value={totalAmount}
                      onValueChange={handleTotalChange}
                      isRequired
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<span className="text-xs text-primary font-bold font-mono">₹</span>}
                    />

                    <div>
                      <Input
                        type="number"
                        label="Advance Collected (₹)"
                        value={advancePaid}
                        onValueChange={handleAdvanceChange}
                        variant="bordered"
                        radius="sm"
                        size="sm"
                        startContent={<span className="text-xs text-[#3F6B1F] font-bold font-mono">₹</span>}
                      />
                      {total > 0 && advance < total && (
                        <button
                          type="button"
                          onClick={fillFullAdvance}
                          className="text-[11px] text-[#3F6B1F] hover:underline mt-1 font-mono font-medium block"
                        >
                          Mark fully paid (₹{total})
                        </button>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-[#F3ECD8] border border-[#D9A427]/40 flex flex-col justify-center">
                      <span className="text-[10px] text-[#241129]/60 uppercase font-mono font-semibold">
                        Pending Due Balance
                      </span>
                      <span
                        className={`text-lg font-bold ${due > 0 ? "text-primary-800" : "text-[#3F6B1F]"}`}
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {due > 0 ? `₹${due.toLocaleString("en-IN")}` : "Fully Settled"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                    <Input
                      type="number"
                      label="Pilot Wage / Pay (₹)"
                      value={driverPay}
                      onValueChange={setDriverPay}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      description="Wage handed to pilot"
                      startContent={<span className="text-xs text-primary font-bold font-mono">₹</span>}
                    />

                    {/* HeroUI Select for Trip Status */}
                    <Select
                      label="Trip Status"
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      selectedKeys={[status]}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as "completed" | "scheduled" | "cancelled";
                        if (val) setStatus(val);
                      }}
                    >
                      <SelectItem key="completed" textValue="Completed">
                        Completed
                      </SelectItem>
                      <SelectItem key="scheduled" textValue="Scheduled">
                        Scheduled / Active
                      </SelectItem>
                      <SelectItem key="cancelled" textValue="Cancelled">
                        Cancelled
                      </SelectItem>
                    </Select>

                    {/* HeroUI Select for Payment Status */}
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
                      <SelectItem key="paid" textValue="Paid in Full">
                        Paid in Full
                      </SelectItem>
                      <SelectItem key="due" textValue="Payment Due">
                        Payment Due
                      </SelectItem>
                    </Select>
                  </div>

                  {total > 0 && (
                    <div className="pt-1 flex items-center justify-between text-xs text-[#241129]/80 bg-[#F8F4E6] p-2.5 rounded-lg border border-[#D9A427]/30 font-mono">
                      <span>Owner Net Margin (Fare ₹{total} − Pilot ₹{pilotWage}):</span>
                      <span className={`font-bold text-sm ${estProfit >= 0 ? "text-[#3F6B1F]" : "text-[#6E1F3A]"}`}>
                        ₹{estProfit.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Notes */}
              <Textarea
                label="Trip Notes &amp; Special Instructions"
                value={notes}
                onValueChange={setNotes}
                variant="bordered"
                radius="sm"
                size="sm"
                minRows={2}
              />
            </ModalBody>

            <ModalFooter className="flex justify-between items-center">
              <Button variant="light" onPress={onClose} radius="sm" className="font-semibold text-gray-600">
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={saving}
                radius="sm"
                className="font-bold text-[#241129] shadow-md px-6"
                startContent={!saving && <DollarSign size={18} />}
              >
                {isEditing ? "Save Changes" : "Confirm Booking"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
