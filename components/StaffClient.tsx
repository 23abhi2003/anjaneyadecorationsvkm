"use client";

import { useMemo, useState } from "react";
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
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  useDisclosure,
  DateRangePicker,
} from "@heroui/react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";

/** Parses an order/assignment date string (YYYY-MM-DD) into a comparable Date, tolerating blanks. */
function toDate(d?: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinRange(dateStr: string | undefined, range: RangeValue<DateValue> | null): boolean {
  if (!range) return true;
  const d = toDate(dateStr);
  if (!d) return false;
  const start = range.start.toDate(getLocalTimeZone());
  const end = range.end.toDate(getLocalTimeZone());
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

interface StaffFormState {
  name: string;
  phone: string;
  pin: string;
}

const emptyStaffForm: StaffFormState = { name: "", phone: "", pin: "" };

export default function StaffClient({ staff, onAdded }: { staff: StaffMember[]; onAdded?: () => void }) {
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

  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [range, setRange] = useState<RangeValue<DateValue> | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [editForm, setEditForm] = useState<StaffFormState>(emptyStaffForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const { isOpen: editOpen, onOpen: openEdit, onOpenChange: onEditOpenChange } = useDisclosure();

  function openStaff(member: StaffMember): void {
    setSelected(member);
    setRange(null);
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
          <Input label="Name" variant="bordered" value={addForm.name} onValueChange={(v) => setAddForm({ ...addForm, name: v })} className="max-w-[200px]" />
          <Input label="Phone number" variant="bordered" value={addForm.phone} onValueChange={(v) => setAddForm({ ...addForm, phone: v })} className="max-w-[200px]" />
          <Input
            label="4-digit PIN"
            variant="bordered"
            inputMode="numeric"
            maxLength={4}
            value={addForm.pin}
            onValueChange={(v) => setAddForm({ ...addForm, pin: v.replace(/\D/g, "").slice(0, 4) })}
            className="max-w-[160px]"
          />
          <Button color="primary" radius="sm" onPress={addStaff} isLoading={saving} className="font-semibold">
            + Add staff
          </Button>
          {addError && <p className="text-sm text-danger basis-full">{addError}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {visibleStaff.map((s) => {
          const totalAmount = (s.assignments || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
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
                  {isOwner && (
                    <Chip color="warning" variant="flat">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </Chip>
                  )}
                </div>
                <p className="text-xs text-foreground/50 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                  {totalEvents} event{totalEvents === 1 ? "" : "s"} assigned &middot; {s.phone || "no phone on file"}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="flat" radius="sm" onPress={() => openStaff(s)}>
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

      {/* Assignments / income modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => {
            if (!selected) return null;
            const filtered = (selected.assignments || []).filter((a) => withinRange(a.date, range));
            const total = filtered.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
            return (
              <>
                <ModalHeader style={{ fontFamily: "var(--font-display)" }}>{selected.name} — assignments</ModalHeader>
                <ModalBody>
                  <DateRangePicker
                    label="Filter by date range"
                    variant="bordered"
                    value={range}
                    onChange={setRange}
                    maxValue={today(getLocalTimeZone())}
                  />
                  {range && (
                    <Button size="sm" variant="light" className="self-start -mt-2" onPress={() => setRange(null)}>
                      Clear filter
                    </Button>
                  )}

                  {filtered.length ? (
                    <div className="overflow-x-auto">
                      <Table aria-label={`${selected.name} assignments`} removeWrapper className="min-w-[520px]">
                        <TableHeader>
                          <TableColumn>ORDER</TableColumn>
                          <TableColumn>CUSTOMER NAME</TableColumn>
                          <TableColumn>AMOUNT</TableColumn>
                          <TableColumn>DATE</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <span className="text-foreground/40 mr-1">{a.orderId}</span>
                                {a.program}
                              </TableCell>
                              <TableCell>{a.customerName}</TableCell>
                              <TableCell>₹{a.amount || 0}</TableCell>
                              <TableCell>{a.date || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/60 py-6 text-center">
                      {selected.assignments?.length ? "No assignments in this date range." : "No assignments yet."}
                    </p>
                  )}
                  {filtered.length > 0 && (
                    <div className="flex justify-between bg-primary/10 border border-primary/40 rounded-md px-4 py-3 mt-2">
                      <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                        {range ? "Total (in range)" : "Total"}
                      </span>
                      <span className="text-warning font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        ₹{total.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" onPress={onClose} radius="sm">
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
