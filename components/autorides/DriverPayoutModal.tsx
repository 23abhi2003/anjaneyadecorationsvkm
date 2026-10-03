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
} from "@heroui/react";
import { DollarSign, Calendar, Wallet } from "lucide-react";
import type { AutoDriver, AutoDriverPayout } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface DriverPayoutModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (payout: AutoDriverPayout) => void;
  defaultDriverName?: string;
  drivers: AutoDriver[];
}

export default function DriverPayoutModal({
  isOpen,
  onOpenChange,
  onSuccess,
  defaultDriverName,
  drivers,
}: DriverPayoutModalProps) {
  const [driverName, setDriverName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDriverName(defaultDriverName || drivers[0]?.name || "");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setMode("Cash");
    setNote("");
    setError("");
  }, [defaultDriverName, drivers, isOpen]);

  async function handleSave() {
    if (!driverName.trim()) {
      setError("Please select a pilot.");
      return;
    }
    if (!amount.trim() || Number.isNaN(parseFloat(amount))) {
      setError("Please enter a valid payout amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Partial<AutoDriverPayout> = {
        driverName: driverName.trim(),
        amount: String(parseFloat(amount) || 0),
        date: date.trim(),
        mode: mode.trim(),
        note: note.trim(),
      };

      const res = await apiFetch("/api/auto-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record payout");
      }

      const saved = (await res.json()) as AutoDriverPayout;
      onSuccess(saved);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Could not record payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      classNames={{
        base: "bg-[#F8F4E6] border-2 border-[#D9A427]/50 text-[#241129] shadow-2xl rounded-2xl",
        header: "border-b border-[#D9A427]/30 pb-3 bg-[#F8F4E6]",
        footer: "border-t border-[#D9A427]/30 pt-3 bg-[#F8F4E6]",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-primary/20 text-[#241129] border border-primary/40">
                  <DollarSign size={22} className="text-[#241129]" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                    Record Pilot Payout
                  </h2>
                  <p className="text-xs text-[#3F6B1F] font-semibold tracking-wider uppercase font-mono">
                    Pilot Settlement Ledger · V.K.M
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}

              <Card className="bg-content1 border border-[#D9A427]/35 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-3.5">
                  <Select
                    label="Select Pilot"
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    selectedKeys={driverName ? [driverName] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as string;
                      if (val) setDriverName(val);
                    }}
                  >
                    {drivers.map((d) => (
                      <SelectItem key={d.name} textValue={`${d.name} (${d.phone})`}>
                        {d.name} {d.phone ? `(${d.phone})` : ""}
                      </SelectItem>
                    ))}
                  </Select>

                  <div className="grid grid-cols-2 gap-3.5">
                    <Input
                      type="number"
                      label="Payout Amount (₹)"
                      value={amount}
                      onValueChange={setAmount}
                      isRequired
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<span className="text-xs text-primary font-bold font-mono">₹</span>}
                    />
                    <Input
                      type="date"
                      label="Payout Date"
                      value={date}
                      onValueChange={setDate}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<Calendar size={16} className="text-primary" />}
                    />
                  </div>

                  <Select
                    label="Payment Mode"
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    selectedKeys={[mode]}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0] as string;
                      if (val) setMode(val);
                    }}
                  >
                    <SelectItem key="Cash" textValue="Cash">
                      Cash
                    </SelectItem>
                    <SelectItem key="UPI / PhonePe / GPay" textValue="UPI / PhonePe / GPay">
                      UPI / PhonePe / GPay
                    </SelectItem>
                    <SelectItem key="Bank Transfer" textValue="Bank Transfer">
                      Bank Transfer
                    </SelectItem>
                    <SelectItem key="Other" textValue="Other">
                      Other
                    </SelectItem>
                  </Select>

                  <Textarea
                    label="Settlement Note / Reference"
                    value={note}
                    onValueChange={setNote}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    minRows={2}
                  />
                </CardBody>
              </Card>
            </ModalBody>

            <ModalFooter className="flex justify-between items-center">
              <Button variant="light" radius="sm" onPress={onClose} className="font-semibold text-gray-600">
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
                Record Payout
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
