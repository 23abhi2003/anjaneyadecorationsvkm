"use client";

import { useState } from "react";
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
} from "@heroui/react";
import type { StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";

export default function StaffClient({ staff, onAdded }: { staff: StaffMember[]; onAdded?: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  function openStaff(member: StaffMember): void {
    setSelected(member);
    onOpen();
  }

  async function addStaff(): Promise<void> {
    if (!name.trim()) return;
    setSaving(true);
    const res = await apiFetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      onAdded?.();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
        Staff
      </h1>

      <div className="bg-content1 rounded-lg p-5 flex flex-wrap items-end gap-3">
        <Input label="New staff name" variant="bordered" value={name} onValueChange={setName} className="max-w-xs" />
        <Button color="primary" radius="sm" onPress={addStaff} isLoading={saving} className="font-semibold">
          + Add staff
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {staff.map((s) => {
          const totalAmount = (s.assignments || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
          const totalEvents = (s.assignments || []).length;
          return (
            <Card key={s.id} isPressable onPress={() => openStaff(s)} className="bg-content1 text-left">
              <CardBody className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    {s.name}
                  </h3>
                  <Chip color="warning" variant="flat">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </Chip>
                </div>
                <p className="text-xs text-foreground/50 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                  {totalEvents} event{totalEvents === 1 ? "" : "s"} assigned &middot; tap to view details
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>
      {staff.length === 0 && <p className="text-[#F8F4E6]/60 text-center py-10">No staff yet.</p>}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => {
            if (!selected) return null;
            const total = (selected.assignments || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
            return (
              <>
                <ModalHeader style={{ fontFamily: "var(--font-display)" }}>{selected.name} — assignments</ModalHeader>
                <ModalBody>
                    {selected.assignments?.length ? (
                    <div className="overflow-x-auto">
                      <Table aria-label={`${selected.name} assignments`} removeWrapper className="min-w-[520px]">
                        <TableHeader>
                        <TableColumn>ORDER</TableColumn>
                        <TableColumn>CUSTOMER NAME</TableColumn>
                        <TableColumn>AMOUNT</TableColumn>
                        <TableColumn>DATE</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {selected.assignments.map((a, i) => (
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
                    <p className="text-sm text-foreground/60 py-6 text-center">No assignments yet.</p>
                  )}
                  {selected.assignments?.length > 0 && (
                    <div className="flex justify-between bg-primary/10 border border-primary/40 rounded-md px-4 py-3 mt-2">
                      <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                        Total
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
    </div>
  );
}
