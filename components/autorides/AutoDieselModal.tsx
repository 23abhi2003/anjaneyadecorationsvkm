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
import { Fuel, Wrench, Calendar } from "lucide-react";
import type { AutoDieselEntry, AutoDriver } from "@/lib/types";
import { apiFetch } from "@/lib/api";

const DIESEL_PRICE_PER_LITRE = 104.32;

interface AutoDieselModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (entry: AutoDieselEntry) => void;
  drivers: AutoDriver[];
  editEntry?: AutoDieselEntry | null;
}

export default function AutoDieselModal({
  isOpen,
  onOpenChange,
  onSuccess,
  drivers,
  editEntry,
}: AutoDieselModalProps) {
  const isEditing = Boolean(editEntry);
  const [type, setType] = useState<"diesel" | "repair">("diesel");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState("");
  const [filledByDriver, setFilledByDriver] = useState("");
  const [repairItem, setRepairItem] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editEntry) {
      setType(editEntry.type || "diesel");
      setDate(editEntry.date || new Date().toISOString().slice(0, 10));
      setTotalAmount(editEntry.totalAmount || "");
      setFilledByDriver(editEntry.filledByDriver || "");
      setRepairItem(editEntry.repairItem || "");
      setNotes(editEntry.notes || "");
    } else {
      setType("diesel");
      setDate(new Date().toISOString().slice(0, 10));
      setTotalAmount("");
      setFilledByDriver(drivers[0]?.name || "");
      setRepairItem("");
      setNotes("");
    }
    setError("");
  }, [editEntry, isOpen, drivers]);

  const amt = parseFloat(totalAmount) || 0;
  const autoLitres = amt > 0 ? (amt / DIESEL_PRICE_PER_LITRE).toFixed(2) : "0.00";

  async function handleSave() {
    if (!totalAmount.trim() || Number.isNaN(parseFloat(totalAmount))) {
      setError("Please enter a valid amount spent.");
      return;
    }

    if (type === "repair" && !repairItem.trim()) {
      setError("Please enter the repair item or service description.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Partial<AutoDieselEntry> = {
        date: date.trim(),
        type,
        totalAmount: String(amt),
        litres: type === "diesel" ? autoLitres : "",
        filledByDriver: type === "diesel" ? filledByDriver.trim() : "",
        stationOrVehicle: "", // Removed per notebook instruction
        repairItem: type === "repair" ? repairItem.trim() : "",
        notes: notes.trim(),
      };

      const url = isEditing && editEntry ? `/api/auto-diesel/${editEntry.id}` : "/api/auto-diesel";
      const method = isEditing ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record expense");
      }

      const saved = (await res.json()) as AutoDieselEntry;
      onSuccess(saved);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Could not record expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      classNames={{
        base: "bg-[#F8F4E6] border-2 border-primary/50 text-[#241129] shadow-2xl rounded-2xl",
        header: "border-b border-primary/30 pb-3 bg-[#F8F4E6]",
        footer: "border-t border-primary/30 pt-3 bg-[#F8F4E6]",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/40 shadow-sm">
                  {type === "diesel" ? <Fuel size={22} /> : <Wrench size={22} />}
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                    {isEditing ? "Edit Vehicle Expense" : "Log Diesel / Repair Expense"}
                  </h2>
                  <p className="text-xs text-primary font-semibold tracking-wider uppercase font-mono">
                    Auto Fleet Investments · V.K.M
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

              {/* Type Switcher */}
              <div className="flex rounded-xl border border-primary/40 p-1 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setType("diesel")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                    type === "diesel"
                      ? "bg-primary text-[#241129] shadow-sm"
                      : "text-[#241129]/70 hover:bg-primary/10"
                  }`}
                >
                  <Fuel size={16} /> Diesel
                </button>
                <button
                  type="button"
                  onClick={() => setType("repair")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                    type === "repair"
                      ? "bg-primary text-[#241129] shadow-sm"
                      : "text-[#241129]/70 hover:bg-primary/10"
                  }`}
                >
                  <Wrench size={16} /> Repair
                </button>
              </div>

              <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      type="date"
                      label="Date"
                      value={date}
                      onValueChange={setDate}
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<Calendar size={16} className="text-primary" />}
                    />
                    <Input
                      type="number"
                      label="Amount (₹)"
                      value={totalAmount}
                      onValueChange={setTotalAmount}
                      isRequired
                      variant="bordered"
                      radius="sm"
                      size="sm"
                      startContent={<span className="text-xs text-primary font-bold font-mono">₹</span>}
                    />
                  </div>

                  {/* DIESEL SECTION (Auto-calculated litres, no manual litres input, no petrol bunk) */}
                  {type === "diesel" && (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between text-xs font-mono">
                        <div className="space-y-0.5">
                          <span className="text-foreground/70 block">Diesel Rate: ₹104.32 / Litre</span>
                          <span className="text-xs font-bold text-[#241129]">
                            Auto-calculated: ~{autoLitres} Litres
                          </span>
                        </div>
                        <Chip size="sm" variant="flat" color="primary" className="font-bold">
                          1L = ₹104.32
                        </Chip>
                      </div>

                      <Select
                        label="Pilot Who Filled"
                        variant="bordered"
                        radius="sm"
                        size="sm"
                        selectedKeys={filledByDriver ? [filledByDriver] : [""]}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0] as string;
                          setFilledByDriver(val || "");
                        }}
                      >
                        {[
                          <SelectItem key="" textValue="Owner directly">
                            -- Owner directly --
                          </SelectItem>,
                          ...drivers.map((d) => (
                            <SelectItem key={d.name} textValue={`${d.name} (${d.phone})`}>
                              {d.name} {d.phone ? `(${d.phone})` : ""}
                            </SelectItem>
                          )),
                        ]}
                      </Select>
                    </div>
                  )}

                  {/* REPAIR SECTION (Repair Item input, No Driver field per notebook spec) */}
                  {type === "repair" && (
                    <div className="space-y-3 pt-1">
                      <Input
                        label="Repair Item"
                        value={repairItem}
                        onValueChange={setRepairItem}
                        isRequired
                        variant="bordered"
                        radius="sm"
                        size="sm"
                      />
                    </div>
                  )}

                  <Textarea
                    label="Notes &amp; Details"
                    value={notes}
                    onValueChange={setNotes}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    minRows={2}
                  />
                </CardBody>
              </Card>
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
                className="font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90 px-6"
              >
                {isEditing ? "Save Changes" : "Record Expense"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
