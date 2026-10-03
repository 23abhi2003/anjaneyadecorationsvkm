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
  Card,
  CardBody,
} from "@heroui/react";
import { User, Phone, Lock, Eye, EyeOff, UserPlus } from "lucide-react";
import type { AutoDriver } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface AddDriverModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (driver: AutoDriver) => void;
  editDriver?: AutoDriver | null;
}

export default function AddDriverModal({
  isOpen,
  onOpenChange,
  onSuccess,
  editDriver,
}: AddDriverModalProps) {
  const isEditing = Boolean(editDriver);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editDriver) {
      setName(editDriver.name || "");
      setPhone(editDriver.phone || "");
      setPin("");
    } else {
      setName("");
      setPhone("");
      setPin("");
    }
    setError("");
  }, [editDriver, isOpen]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter the pilot full name.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter a valid 10-digit mobile phone number.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Partial<AutoDriver> = {
        name: name.trim(),
        phone: phone.trim(),
      };
      if (pin.trim()) {
        payload.pin = pin.trim();
      }

      const url = isEditing && editDriver ? `/api/auto-drivers/${editDriver.id}` : "/api/auto-drivers";
      const method = isEditing ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save pilot profile");
      }

      const saved = (await res.json()) as AutoDriver;
      onSuccess(saved);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Could not save pilot profile.");
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
                  <UserPlus size={22} className="text-[#241129]" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                    {isEditing ? `Edit Pilot (${editDriver?.name})` : "Register New Auto Pilot"}
                  </h2>
                  <p className="text-xs text-[#3F6B1F] font-semibold tracking-wider uppercase font-mono">
                    Auto Pilot Fleet · V.K.M
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
                  <Input
                    label="Pilot Full Name"
                    value={name}
                    onValueChange={setName}
                    isRequired
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    startContent={<User size={16} className="text-primary" />}
                  />

                  <Input
                    label="Mobile Phone Number"
                    value={phone}
                    onValueChange={setPhone}
                    isRequired
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    startContent={<Phone size={16} className="text-primary" />}
                  />

                  <Input
                    type={showPin ? "text" : "password"}
                    label={isEditing ? "New 4-Digit Login PIN (optional)" : "4-Digit Login PIN"}
                    value={pin}
                    onValueChange={setPin}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    maxLength={6}
                    description="Used by pilot to sign in and view assigned trips & wages"
                    startContent={<Lock size={16} className="text-primary" />}
                    endContent={
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
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
              >
                {isEditing ? "Save Changes" : "Register Pilot"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
