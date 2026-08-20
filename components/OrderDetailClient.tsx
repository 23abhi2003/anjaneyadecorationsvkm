"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Divider, Input, Button, Chip, Select, SelectItem, Textarea } from "@heroui/react";
import Image from "next/image";
import type { Order, OrderStatus } from "@/lib/types";
import { collectItemLines, mapsLinkForOrder } from "@/lib/orderDisplay";
import { generateInvoicePdf, generateStaffReportPdf } from "@/lib/pdf";
import { apiFetch } from "@/lib/api";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "confirmed", "completed"];
const PAYMENT_OPTIONS: string[] = ["UPI", "Cash", "Other"];

export default function OrderDetailClient({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status || "pending");
  const [invoice, setInvoice] = useState({
    totalAmount: order.invoice?.totalAmount || "",
    advancePaid: order.invoice?.advancePaid || "",
    paymentType: order.invoice?.paymentType || "",
  });
  const [notes, setNotes] = useState(order.notes || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pdfBusy, setPdfBusy] = useState<"invoice" | "report" | null>(null);

  const total = parseFloat(invoice.totalAmount) || 0;
  const advance = parseFloat(invoice.advancePaid) || 0;
  const due = Math.max(total - advance, 0);

  async function onSave(): Promise<void> {
    setSaving(true);
    const res = await apiFetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, invoice: { ...invoice, dueAmount: String(due) }, notes }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(new Date());
    }
  }

  async function onDelete(): Promise<void> {
    if (!confirm(`Delete order ${order.id} for ${order.customer?.name}? This can't be undone.`)) return;
    const res = await apiFetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/orders");
    }
  }

  async function onDownloadInvoice(): Promise<void> {
    setPdfBusy("invoice");
    try {
      await generateInvoicePdf({ ...order, status, invoice: { ...invoice, dueAmount: String(due) }, notes });
    } finally {
      setPdfBusy(null);
    }
  }

  async function onDownloadStaffReport(): Promise<void> {
    setPdfBusy("report");
    try {
      await generateStaffReportPdf({ ...order, status, invoice: { ...invoice, dueAmount: String(due) }, notes });
    } finally {
      setPdfBusy(null);
    }
  }

  function onShareWhatsApp(): void {
    const digits = (order.customer.phone || "").replace(/\D/g, "");
    if (!digits) {
      alert("This order has no phone number saved for the customer yet.");
      return;
    }
    // Assume a 10-digit local number is Indian (+91); leave longer numbers as-is.
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const lines = [
      `Anjaneya Decorations — ${order.id}`,
      `Hi ${order.customer.name || ""}, here are your order details:`,
      `Program: ${order.program?.type || order.serviceType}`,
      `Event date: ${order.eventDate || "-"}`,
      `Total: ₹${total.toLocaleString("en-IN")}  Advance: ₹${advance.toLocaleString("en-IN")}  Due: ₹${due.toLocaleString("en-IN")}`,
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const itemGroups = collectItemLines(order);
  const mapsLink = mapsLinkForOrder(order);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#D9A427]" style={{ fontFamily: "var(--font-mono)" }}>
            {order.id}
          </p>
          <h1 className="text-3xl font-semibold text-[#F8F4E6] mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {order.customer?.name}
          </h1>
          <p className="text-[#F8F4E6]/60 text-sm mt-1">
            {order.customer?.phone} &middot; {order.program?.type || order.serviceType} &middot; {order.eventDate || "no date"}
          </p>
          {order.customer?.address && <p className="text-[#F8F4E6]/50 text-sm mt-0.5">{order.customer.address}</p>}
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-[#D9A427] hover:underline mt-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              View on Google Maps &rarr;
            </a>
          )}
        </div>
        <Image src="/logo.png" alt="Anjaneya Decorations" width={56} height={84} className="rounded-sm shrink-0" />
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <Button color="primary" radius="sm" onPress={onDownloadInvoice} isLoading={pdfBusy === "invoice"} className="font-semibold">
          Download Invoice (customer)
        </Button>
        <Button color="secondary" radius="sm" variant="flat" onPress={onDownloadStaffReport} isLoading={pdfBusy === "report"} className="font-semibold">
          Download Staff Report
        </Button>
        <Button color="success" radius="sm" variant="solid" onPress={onShareWhatsApp} className="font-semibold">
          Share on WhatsApp
        </Button>
      </div>

      <Card className="bg-content1">
        <CardBody className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              label="Status"
              selectedKeys={[status]}
              onSelectionChange={(keys) => setStatus(Array.from(keys)[0] as OrderStatus)}
              className="max-w-[200px]"
              variant="bordered"
            >
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s}>{s}</SelectItem>
              ))}
            </Select>
            <Chip color="secondary" variant="flat">
              {order.serviceType}
            </Chip>
          </div>

          <Divider />

          {itemGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Items
              </h2>
              <ul className="text-sm text-foreground/80 space-y-1 list-disc list-inside">
                {itemGroups.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {order.staffAssigned?.length > 0 && (
            <>
              <Divider />
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                  Staff assigned
                </h2>
                <div className="flex flex-wrap gap-2">
                  {order.staffAssigned.map((s, i) => (
                    <Chip key={i} variant="flat" color="warning">
                      {s.name} — ₹{s.amount || 0}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}

          <Divider />

          <div>
            <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Invoice
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Total amount (₹)"
                type="number"
                variant="bordered"
                value={invoice.totalAmount}
                onValueChange={(v) => setInvoice({ ...invoice, totalAmount: v })}
              />
              <Input
                label="Advance paid (₹)"
                type="number"
                variant="bordered"
                value={invoice.advancePaid}
                onValueChange={(v) => setInvoice({ ...invoice, advancePaid: v })}
              />
            </div>
            <div className="mt-4 bg-primary/10 border border-primary/40 rounded-md px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
                Due amount
              </span>
              <span className="text-xl text-warning" style={{ fontFamily: "var(--font-display)" }}>
                ₹{due.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              {PAYMENT_OPTIONS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  radius="full"
                  variant={invoice.paymentType === t ? "solid" : "bordered"}
                  color={invoice.paymentType === t ? "secondary" : "default"}
                  onPress={() => setInvoice({ ...invoice, paymentType: t })}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <Divider />

          <Textarea label="Notes" variant="bordered" value={notes} onValueChange={setNotes} minRows={3} />

          <div className="flex items-center gap-3 no-print">
            <Button color="primary" onPress={onSave} isLoading={saving} radius="sm" className="font-semibold">
              Save changes
            </Button>
            <Button color="danger" variant="bordered" onPress={onDelete} radius="sm">
              Delete order
            </Button>
            {savedAt && <span className="text-xs text-success">Saved.</span>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
