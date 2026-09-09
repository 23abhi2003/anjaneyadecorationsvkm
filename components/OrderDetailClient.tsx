"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  Divider,
  Input,
  Button,
  Chip,
  Select,
  SelectItem,
  Textarea,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import Image from "next/image";
import type { Order, OrderStatus, CompletionStatus, StaffMember } from "@/lib/types";
import { collectItemLines, mapsLinkForOrder, waLink, buildStaffWhatsAppMessage } from "@/lib/orderDisplay";
import { generateInvoicePdf, generateStaffReportPdf, getStaffReportPdfFile, type InvoiceLanguage } from "@/lib/pdf";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";

const PAYMENT_OPTIONS: string[] = ["UPI", "Cash", "Other"];

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

export default function OrderDetailClient({ order, staffList = [] }: { order: Order; staffList?: StaffMember[] }) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [orderCompletion, setOrderCompletion] = useState<CompletionStatus>(order.orderCompletionStatus || "pending");
  const [paymentCompletion, setPaymentCompletion] = useState<CompletionStatus>(order.paymentCompletionStatus || "pending");
  const [invoice, setInvoice] = useState({
    totalAmount: order.invoice?.totalAmount || "",
    advancePaid: order.invoice?.advancePaid || "",
    paymentType: order.invoice?.paymentType || "",
  });
  const [notes, setNotes] = useState(order.notes || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pdfBusy, setPdfBusy] = useState<"invoice" | "report" | null>(null);
  // Which staff-send button is currently mid-flight — a staffId, "all", or null.
  const [staffSendBusy, setStaffSendBusy] = useState<string | null>(null);
  // Remaining staff to message after "Send to Staff (all)" — browsers only allow ONE
  // window.open() per real click, so the rest wait here for a "Send to next" click.
  const [staffQueue, setStaffQueue] = useState<{ staffId: string; name: string }[]>([]);

  const total = parseFloat(invoice.totalAmount) || 0;
  const advance = parseFloat(invoice.advancePaid) || 0;
  const due = Math.max(total - advance, 0);

  // Mirrors the backend's computeOverallStatus() so the chip updates instantly, before save.
  const overallStatus: OrderStatus =
    orderCompletion === "completed" && paymentCompletion === "completed"
      ? "completed"
      : orderCompletion === "completed" || paymentCompletion === "completed" || order.status === "confirmed"
        ? "confirmed"
        : "pending";

  async function onSave(): Promise<void> {
    setSaving(true);
    const payload: Partial<Order> = {
      orderCompletionStatus: orderCompletion,
      notes,
      ...(isOwner
        ? {
            paymentCompletionStatus: paymentCompletion,
            invoice: { ...invoice, dueAmount: String(due) },
          }
        : {}),
    };
    const res = await apiFetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async function onDownloadInvoice(language: InvoiceLanguage): Promise<void> {
    setPdfBusy("invoice");
    try {
      await generateInvoicePdf(
        { ...order, status: overallStatus, invoice: { ...invoice, dueAmount: String(due) }, notes },
        language,
      );
    } finally {
      setPdfBusy(null);
    }
  }

  async function onDownloadStaffReport(): Promise<void> {
    setPdfBusy("report");
    try {
      await generateStaffReportPdf({ ...order, status: overallStatus, invoice: { ...invoice, dueAmount: String(due) }, notes });
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
      ...(isOwner
        ? [`Total: ₹${total.toLocaleString("en-IN")}  Advance: ₹${advance.toLocaleString("en-IN")}  Due: ₹${due.toLocaleString("en-IN")}`]
        : []),
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /** Looks up a staff member's saved phone number from their id. Empty string if none on file. */
  function phoneForStaffId(staffId: string): string {
    return staffList.find((s) => s.id === staffId)?.phone || "";
  }

  /**
   * "Send" for one staff member: opens a WhatsApp chat (via wa.me — no API
   * key, no token, exactly like clicking the link yourself) to their saved
   * number with a message that includes the date, then downloads the staff
   * report PDF so it's sitting in Downloads ready to attach in that chat by
   * hand. WhatsApp only lets a real Business API account attach files
   * automatically; this manual two-step is the no-token equivalent.
   */
  async function sendToStaff(staffId: string, name: string): Promise<void> {
    const link = waLink(phoneForStaffId(staffId), buildStaffWhatsAppMessage(order, name));
    if (!link) {
      alert(`${name} doesn't have a phone number on file yet — add one on the Staff page first.`);
      return;
    }
    // Open the chat tab first, synchronously, in the same click so popup blockers don't catch it.
    window.open(link, "_blank", "noopener,noreferrer");
    setStaffSendBusy(staffId);
    try {
      await generateStaffReportPdf({ ...order, status: overallStatus, notes });
    } finally {
      setStaffSendBusy(null);
    }
  }

  /**
   * "Send" to every assigned staff member.
   *
   * Preferred path — the OS/native share sheet (`navigator.share`, no API key,
   * no token, just the same "Share" action any app on the phone offers): the
   * person taps Share once, picks WhatsApp, and WhatsApp's own multi-select
   * screen lets them forward the PDF + message to every staff chat at once.
   * That's the only way to reach several individual chats from one action
   * without WhatsApp's paid Business API.
   *
   * Fallback — most desktop browsers can't share files this way. There,
   * browsers also only trust ONE new-tab open per real click (a loop of
   * window.open() calls just gets the rest silently blocked), so instead the
   * first staff member's chat opens immediately and the rest queue up behind
   * a "Send to next" button — each click is a fresh real click, so it isn't
   * blocked either.
   */
  async function sendToAllStaff(): Promise<void> {
    const targets = order.staffAssigned.filter((s) => phoneForStaffId(s.staffId));
    if (targets.length === 0) {
      alert("None of the assigned staff have a phone number on file yet — add numbers on the Staff page first.");
      return;
    }
    setStaffSendBusy("all");
    try {
      const file = await getStaffReportPdfFile({ ...order, status: overallStatus, notes });
      const names = targets.map((t) => t.name).join(", ");
      const message = buildStaffWhatsAppMessage(order, names);

      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], text: message, title: `Staff report — ${order.id}` });
          return; // done — WhatsApp's own screen handled sending to everyone
        } catch (err) {
          // User cancelled the share sheet — not an error, just stop here.
          if ((err as { name?: string })?.name === "AbortError") return;
          // Any other failure (e.g. no share target chosen) falls through to the tab-based flow below.
        }
      }

      // Fallback: open the first chat now, queue the rest, and also trigger a
      // normal download since this path can't hand the PDF over automatically.
      const [first, ...rest] = targets;
      const link = waLink(phoneForStaffId(first.staffId), buildStaffWhatsAppMessage(order, first.name));
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      setStaffQueue(rest);
      await generateStaffReportPdf({ ...order, status: overallStatus, notes });
    } finally {
      setStaffSendBusy(null);
    }
  }

  /** Advances the queue by one — called from a real click, so its window.open() isn't blocked. */
  function sendToNextInQueue(): void {
    if (staffQueue.length === 0) return;
    const [next, ...rest] = staffQueue;
    const link = waLink(phoneForStaffId(next.staffId), buildStaffWhatsAppMessage(order, next.name));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setStaffQueue(rest);
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
        <Image src="/logo-new.png" alt="Anjaneya Decorations" width={56} height={84} className="rounded-sm shrink-0" />
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <Button
          as={Link}
          href={`/orders/edit?id=${encodeURIComponent(order.id)}`}
          color="primary"
          radius="sm"
          variant="flat"
          className="font-semibold"
        >
          Edit order
        </Button>
        {isOwner && (
          <Dropdown>
            <DropdownTrigger>
              <Button color="primary" radius="sm" isLoading={pdfBusy === "invoice"} className="font-semibold">
                Download Invoice (customer)
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Choose invoice language"
              onAction={(key) => onDownloadInvoice(key as InvoiceLanguage)}
            >
              <DropdownItem key="en">English</DropdownItem>
              <DropdownItem key="te">తెలుగు (Telugu)</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
        <Button color="primary" radius="sm" variant="flat" onPress={onDownloadStaffReport} isLoading={pdfBusy === "report"} className="font-semibold">
          Download Staff Report
        </Button>
        <Button color="success" radius="sm" variant="solid" onPress={onShareWhatsApp} className="font-semibold">
          Share on WhatsApp
        </Button>
        {isOwner && order.staffAssigned && order.staffAssigned.length > 0 && (
          <Button
            color="success"
            radius="sm"
            variant="bordered"
            onPress={sendToAllStaff}
            isLoading={staffSendBusy === "all"}
            className="font-semibold"
          >
            Send to Staff (WhatsApp + PDF)
          </Button>
        )}
      </div>

      <Card className="bg-content1">
        <CardBody className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Chip color={statusColor[overallStatus]} variant="flat" className="uppercase text-xs font-semibold">
              {overallStatus}
            </Chip>
            <Chip color="secondary" variant="flat">
              {order.serviceType}
            </Chip>
          </div>

          <Divider />

          <div>
            <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Completion status
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label="Order completion"
                description="Has the tent/decoration work been done?"
                selectedKeys={[orderCompletion]}
                onSelectionChange={(keys) => setOrderCompletion(Array.from(keys)[0] as CompletionStatus)}
                variant="bordered"
              >
                <SelectItem key="pending">pending</SelectItem>
                <SelectItem key="completed">completed</SelectItem>
              </Select>
              {isOwner ? (
                <Select
                  label="Payment completion"
                  description="Has the invoice been paid in full?"
                  selectedKeys={[paymentCompletion]}
                  onSelectionChange={(keys) => setPaymentCompletion(Array.from(keys)[0] as CompletionStatus)}
                  variant="bordered"
                >
                  <SelectItem key="pending">pending</SelectItem>
                  <SelectItem key="completed">completed</SelectItem>
                </Select>
              ) : (
                <div className="flex items-center rounded-md border border-content3 px-3 text-sm text-foreground/50">
                  Payment status is managed by the owner.
                </div>
              )}
            </div>
            <p className="text-xs text-foreground/50 mt-2" style={{ fontFamily: "var(--font-mono)" }}>
              The order is only marked "completed" once both are complete.
            </p>
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

          {order.staffAssigned && order.staffAssigned.length > 0 && (
            <>
              <Divider />
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                  Staff assigned
                </h2>
                <div className="flex flex-wrap gap-2">
                  {order.staffAssigned.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Chip variant="flat" color="warning">
                        {s.name}
                        {isOwner ? ` — ₹${s.amount || 0}` : ""}
                      </Chip>
                      {isOwner && phoneForStaffId(s.staffId) && (
                        <Button
                          size="sm"
                          isIconOnly
                          radius="full"
                          color="success"
                          variant="flat"
                          isLoading={staffSendBusy === s.staffId}
                          onPress={() => sendToStaff(s.staffId, s.name)}
                          title={`Send WhatsApp + PDF to ${s.name}`}
                          aria-label={`Send WhatsApp + PDF to ${s.name}`}
                        >
                          {staffSendBusy === s.staffId ? "" : "💬"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {isOwner && order.staffAssigned.some((s) => !phoneForStaffId(s.staffId)) && (
                  <p className="text-xs text-foreground/40 mt-2" style={{ fontFamily: "var(--font-mono)" }}>
                    Staff without a 💬 button don&apos;t have a phone number on file yet — add one on the Staff page.
                  </p>
                )}
                {isOwner && staffQueue.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-success/10 border border-success/30 rounded-md px-3 py-2">
                    <span className="text-xs text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
                      Sent to {order.staffAssigned.length - staffQueue.length} of {order.staffAssigned.length} — your
                      browser only opens one WhatsApp tab per click.
                    </span>
                    <Button size="sm" color="success" radius="sm" onPress={sendToNextInQueue} className="font-semibold">
                      Send to next ({staffQueue[0].name})
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {isOwner && (
            <>
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
            </>
          )}

          <Divider />

          <div>
            <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Notes
            </h2>
            <Textarea
              aria-label="Notes"
              placeholder="Anything staff or the office should know about this order…"
              variant="bordered"
              value={notes}
              onValueChange={setNotes}
              minRows={3}
            />
          </div>

          <div className="flex items-center gap-3 no-print">
            <Button color="primary" onPress={onSave} isLoading={saving} radius="sm" className="font-semibold">
              Save changes
            </Button>
            {isOwner && (
              <Button color="danger" variant="bordered" onPress={onDelete} radius="sm">
                Delete order
              </Button>
            )}
            {savedAt && <span className="text-xs text-success">Saved.</span>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}