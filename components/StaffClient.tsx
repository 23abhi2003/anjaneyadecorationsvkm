"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardBody,
  Input,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import type { StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { inr, staffBalance, summarizeAssignments } from "@/lib/staffPay";

interface StaffFormState {
  name: string;
  phone: string;
  pin: string;
}

const emptyStaffForm: StaffFormState = { name: "", phone: "", pin: "" };

export default function StaffClient({
  staff,
  onAdded,
  onRefresh,
}: {
  staff: StaffMember[];
  onAdded?: () => void;
  /** Re-fetch staff WITHOUT unmounting this page, so an open modal survives (falls back to onAdded). */
  onRefresh?: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  // Staff accounts only ever see their own record on this page.
  const visibleStaff = useMemo(
    () => (isOwner ? staff : staff.filter((s) => s.id === user?.staffId)),
    [isOwner, staff, user?.staffId]
  );

  const [addForm, setAddForm] = useState<StaffFormState>(emptyStaffForm);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Clicking a staff member's name opens this small profile modal. It's just
  // a quick summary — "View assignments" is the full page (see app/staff/assignments).
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [editForm, setEditForm] = useState<StaffFormState>(emptyStaffForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const { isOpen: editOpen, onOpen: openEdit, onOpenChange: onEditOpenChange } = useDisclosure();

  function openStaff(member: StaffMember): void {
    setSelected(member);
    onOpen();
  }

  function openEditModal(member: StaffMember): void {
    setSelected(member);
    setEditForm({ name: member.name || "", phone: member.phone || "", pin: "" });
    setEditError("");
    openEdit();
  }

  async function addStaff(): Promise<void> {
    if (!addForm.name.trim()) return;
    setSaving(true);
    setAddError("");
    const res = await apiFetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setSaving(false);
    if (res.ok) {
      setAddForm(emptyStaffForm);
      onAdded?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setAddError((data as { error?: string }).error || "Could not add staff.");
    }
  }

  async function saveEdit(): Promise<void> {
    if (!selected) return;
    setEditSaving(true);
    setEditError("");
    const payload: Partial<StaffFormState> = { name: editForm.name, phone: editForm.phone };
    if (editForm.pin.trim()) payload.pin = editForm.pin.trim();
    const res = await apiFetch(`/api/staff/${encodeURIComponent(selected.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditSaving(false);
    if (res.ok) {
      onEditOpenChange();
      onAdded?.();
    } else {
      const data = await res.json().catch(() => ({}));
      setEditError((data as { error?: string }).error || "Could not save changes.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
        Staff
      </h1>

      {isOwner && (
        <div className="bg-content1 rounded-lg p-5 flex flex-wrap items-end gap-3">
          <Input label="Name" variant="bordered" value={addForm.name} onValueChange={(v) => setAddForm({ ...addForm, name: v })} className="max-w-50" />
          <Input label="Phone number" variant="bordered" value={addForm.phone} onValueChange={(v) => setAddForm({ ...addForm, phone: v })} className="max-w-50" />
          <Input
            label="4-digit PIN"
            variant="bordered"
            inputMode="numeric"
            maxLength={4}
            value={addForm.pin}
            onValueChange={(v) => setAddForm({ ...addForm, pin: v.replace(/\D/g, "").slice(0, 4) })}
            className="max-w-40"
          />
          <Button color="primary" radius="sm" onPress={addStaff} isLoading={saving} className="font-semibold">
            + Add staff
          </Button>
          {addError && <p className="text-sm text-danger basis-full">{addError}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {visibleStaff.map((s) => {
          const pay = summarizeAssignments(s.assignments || []);
          const bal = staffBalance(s.assignments, s.borrows);
          const totalEvents = (s.assignments || []).length;
          const canManage = isOwner || s.id === user?.staffId;
          return (
            <Card key={s.id} className="bg-content1 text-left">
              <CardBody className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => openStaff(s)} className="text-left flex-1">
                    <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {s.name}
                    </h3>
                  </button>
                  {canManage && (
                    <Chip color="warning" variant="flat">
                      {inr(pay.total)}
                    </Chip>
                  )}
                </div>
                {canManage && bal.borrowed > 0 && (
                  <p className="text-sm mt-1">
                    <span className="text-foreground/50">Remaining (after borrows): </span>
                    <span className={`font-semibold ${bal.remaining < 0 ? "text-danger" : "text-primary"}`}>
                      {inr(bal.remaining)}
                    </span>
                  </p>
                )}
                <p className="text-xs text-foreground/50 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                  {totalEvents} event{totalEvents === 1 ? "" : "s"} assigned &middot; {s.phone || "no phone on file"}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    as={Link}
                    href={`/staff/assignments?id=${encodeURIComponent(s.id)}`}
                    size="sm"
                    variant="flat"
                    radius="sm"
                  >
                    View assignments
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="bordered" radius="sm" onPress={() => openEditModal(s)}>
                      Edit
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      {visibleStaff.length === 0 && <p className="text-[#F8F4E6]/60 text-center py-10">No staff yet.</p>}

      {/* Staff profile modal — opened by clicking a name. Quick summary only;
          the full assignments table lives on its own page (see the "View
          assignments" button above). */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
        <ModalContent>
          {(onClose) => {
            if (!selected) return null;
            const pay = summarizeAssignments(selected.assignments || []);
            const bal = staffBalance(selected.assignments, selected.borrows);
            const totalEvents = (selected.assignments || []).length;
            const canManage = isOwner || selected.id === user?.staffId;
            return (
              <>
                <ModalHeader style={{ fontFamily: "var(--font-display)" }}>{selected.name}</ModalHeader>
                <ModalBody className="space-y-2 pb-2">
                  <p className="text-sm text-foreground/70">
                    <span className="text-foreground/50">Phone: </span>
                    {selected.phone || "no phone on file"}
                  </p>
                  <p className="text-sm text-foreground/70">
                    <span className="text-foreground/50">Events assigned: </span>
                    {totalEvents}
                  </p>
                  {canManage && (
                    <>
                      <p className="text-sm text-foreground/70">
                        <span className="text-foreground/50">Total earnings: </span>
                        <span className="text-warning font-semibold">{inr(pay.total)}</span>
                      </p>
                      {isOwner && (
                        <p className="text-sm text-foreground/70">
                          <span className="text-foreground/50">Paid (incl. advances): </span>
                          <span className="text-success font-semibold">{inr(pay.paid)}</span>
                        </p>
                      )}
                      {isOwner && (
                        <p className="text-sm text-foreground/70">
                          <span className="text-foreground/50">Still due: </span>
                          <span className="text-danger font-semibold">{inr(pay.due)}</span>
                        </p>
                      )}
                      <p className="text-sm text-foreground/70">
                        <span className="text-foreground/50">Borrowed: </span>
                        <span className="text-warning font-semibold">{inr(bal.borrowed)}</span>
                      </p>
                      <p className="text-sm text-foreground/70">
                        <span className="text-foreground/50">Remaining after borrows: </span>
                        <span className={`font-semibold ${bal.remaining < 0 ? "text-danger" : "text-success"}`}>
                          {inr(bal.remaining)}
                        </span>
                      </p>
                    </>
                  )}
                </ModalBody>
                <ModalFooter className="flex-wrap">
                  {canManage && (
                    <Button
                      variant="bordered"
                      radius="sm"
                      onPress={() => {
                        onClose();
                        openEditModal(selected);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    as={Link}
                    href={`/staff/assignments?id=${encodeURIComponent(selected.id)}`}
                    color="primary"
                    radius="sm"
                    className="font-semibold"
                  >
                    View assignments
                  </Button>
                  <Button variant="light" onPress={onClose} radius="sm">
                    Close
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Edit staff profile modal */}
      <Modal isOpen={editOpen} onOpenChange={onEditOpenChange} size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader style={{ fontFamily: "var(--font-display)" }}>Edit staff details</ModalHeader>
              <ModalBody className="space-y-3">
                <Input label="Name" variant="bordered" value={editForm.name} onValueChange={(v) => setEditForm({ ...editForm, name: v })} />
                <Input label="Phone number" variant="bordered" value={editForm.phone} onValueChange={(v) => setEditForm({ ...editForm, phone: v })} />
                <Input
                  label="New 4-digit PIN"
                  description="Leave blank to keep the current PIN."
                  variant="bordered"
                  inputMode="numeric"
                  maxLength={4}
                  value={editForm.pin}
                  onValueChange={(v) => setEditForm({ ...editForm, pin: v.replace(/\D/g, "").slice(0, 4) })}
                />
                {editError && <p className="text-sm text-danger">{editError}</p>}
              </ModalBody>
              <ModalFooter>
                <Button variant="bordered" onPress={onClose} radius="sm">
                  Cancel
                </Button>
                <Button color="primary" onPress={saveEdit} isLoading={editSaving} radius="sm" className="font-semibold">
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}