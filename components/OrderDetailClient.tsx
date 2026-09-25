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
  Checkbox,
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
import { assignmentMoney, inr } from "@/lib/staffPay";
import BackButton from "@/components/BackButton";

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
    investment: order.invoice?.investment || "",
  });
  const [notes, setNotes] = useState(order.notes || "");
  const [returnedItems, setReturnedItems] = useState<Record<string, boolean>>(order.returnedItems || {});
  const [returnedItemQtys, setReturnedItemQtys] = useState<Record<string, number>>(order.returnedItemQtys || {});
  const [itemReturnNotes, setItemReturnNotes] = useState(order.itemReturnNotes || "");
  const [itemFilter, setItemFilter] = useState<"all" | "remaining" | "returned">("all");
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
  const investment = parseFloat(invoice.investment) || 0;
  const staffTotal = (order.staffAssigned || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const profit = total - staffTotal - investment;

  // Mirrors the backend's computeOverallStatus() so the chip updates instantly, before save.
  const overallStatus: OrderStatus =
    orderCompletion === "completed" && paymentCompletion === "completed"
      ? "completed"
      : orderCompletion === "completed" || paymentCompletion === "completed" || order.status === "confirmed"
        ? "confirmed"
        : "pending";

  // A fully completed order (work done + payment done) is never treated as having a due —
  // regardless of what the raw total/advance numbers say.
  const due = overallStatus === "completed" ? 0 : Math.max(total - advance, 0);

  async function onSave(): Promise<void> {
    setSaving(true);
    const payload: Partial<Order> = {
      orderCompletionStatus: orderCompletion,
      notes,
      returnedItems,
      returnedItemQtys,
      itemReturnNotes,
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

  /** Parses "Label: qty" format — label is everything before the last colon, qty is the number after. */
  function parseItemLine(line: string): { label: string; qty: string } {
    const lastColon = line.lastIndexOf(":");
    if (lastColon !== -1) {
      return {
        label: line.slice(0, lastColon).trim(),
        qty: line.slice(lastColon + 1).trim(),
      };
    }
    return { label: line, qty: "" };
  }

  /** Parses qty string to a number (e.g. "2" → 2). Returns 1 if not a valid number. */
  function getItemTotalQty(qty: string): number {
    const n = parseInt(qty, 10);
    return isNaN(n) || n <= 0 ? 1 : n;
  }

  /** Returns how many of this item have been marked as returned (0 if none). */
  function getReturnedQty(line: string, index: number): number {
    const keyWithIndex = `${index}::${line}`;
    if (returnedItemQtys[keyWithIndex] !== undefined) return returnedItemQtys[keyWithIndex];
    if (returnedItemQtys[line] !== undefined) return returnedItemQtys[line];
    // Legacy: if returnedItems is true but no qty saved, assume full qty returned.
    if (isItemFullyReturned(line, index)) {
      const { qty } = parseItemLine(line);
      return getItemTotalQty(qty);
    }
    return 0;
  }

  /** True only if all units of this item have been returned. */
  function isItemFullyReturned(line: string, index: number): boolean {
    const keyWithIndex = `${index}::${line}`;
    if (returnedItems[keyWithIndex] !== undefined) return !!returnedItems[keyWithIndex];
    if (returnedItems[line] !== undefined) return !!returnedItems[line];
    return false;
  }

  /** True if at least 1 unit is returned (partial counts). Used for filter. */
  function isItemReturned(line: string, index: number): boolean {
    return isItemFullyReturned(line, index) || getReturnedQty(line, index) > 0;
  }

  /** Sets the returned qty for an item and auto-marks full/partial return boolean. */
  function setReturnedQty(line: string, index: number, qty: string, totalQty: number): void {
    const keyWithIndex = `${index}::${line}`;
    const returned = Math.max(0, Math.min(parseInt(qty, 10) || 0, totalQty));
    const isFull = returned >= totalQty;
    setReturnedItemQtys((prev) => ({
      ...prev,
      [keyWithIndex]: returned,
      [line]: returned,
    }));
    setReturnedItems((prev) => ({
      ...prev,
      [keyWithIndex]: isFull,
      [line]: isFull,
    }));
  }

  /** Toggle checkbox: if item has qty>1, toggle between 0 and full qty. */
  function toggleItemReturn(line: string, index: number): void {
    const { qty } = parseItemLine(line);
    const totalQty = getItemTotalQty(qty);
    const currentQty = getReturnedQty(line, index);
    const nextFull = currentQty < totalQty;
    const nextQty = nextFull ? totalQty : 0;
    const keyWithIndex = `${index}::${line}`;
    setReturnedItemQtys((prev) => ({
      ...prev,
      [keyWithIndex]: nextQty,
      [line]: nextQty,
    }));
    setReturnedItems((prev) => ({
      ...prev,
      [keyWithIndex]: nextFull,
      [line]: nextFull,
    }));
  }

  function markAllReturned(): void {
    const updatedBool: Record<string, boolean> = { ...returnedItems };
    const updatedQtys: Record<string, number> = { ...returnedItemQtys };
    itemGroups.forEach((line, index) => {
      const { qty } = parseItemLine(line);
      const totalQty = getItemTotalQty(qty);
      updatedBool[`${index}::${line}`] = true;
      updatedBool[line] = true;
      updatedQtys[`${index}::${line}`] = totalQty;
      updatedQtys[line] = totalQty;
    });
    setReturnedItems(updatedBool);
    setReturnedItemQtys(updatedQtys);
  }

  function uncheckAllReturned(): void {
    const updatedBool: Record<string, boolean> = { ...returnedItems };
    const updatedQtys: Record<string, number> = { ...returnedItemQtys };
    itemGroups.forEach((line, index) => {
      updatedBool[`${index}::${line}`] = false;
      updatedBool[line] = false;
      updatedQtys[`${index}::${line}`] = 0;
      updatedQtys[line] = 0;
    });
    setReturnedItems(updatedBool);
    setReturnedItemQtys(updatedQtys);
  }

  // Count items as "returned" only when fully returned (all qty back).
  const returnedCount = itemGroups.filter((line, i) => isItemFullyReturned(line, i)).length;
  const remainingCount = itemGroups.length - returnedCount;
  const allReturned = itemGroups.length > 0 && remainingCount === 0;

  const displayedItems = itemGroups
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => {
      if (itemFilter === "remaining") return !isItemFullyReturned(line, index);
      if (itemFilter === "returned") return isItemFullyReturned(line, index);
      return true;
    });

  return (
    <div className="space-y-6">
      <div className="no-print">
        <BackButton href="/orders" label="Back to Orders" />
      </div>

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
          {order.customer?.referredBy?.trim() && (
            <p className="text-[#F8F4E6]/50 text-sm mt-0.5">Referred by {order.customer.referredBy.trim()}</p>
          )}
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
            <div className="space-y-4">
              {/* Section Header & Return Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      Items & Final Return Check
                    </h2>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={allReturned ? "success" : returnedCount > 0 ? "warning" : "default"}
                      className="font-medium"
                    >
                      {allReturned
                        ? `All items returned to shop (${itemGroups.length}/${itemGroups.length})`
                        : returnedCount > 0
                          ? `${returnedCount} returned · ${remainingCount} remaining`
                          : `Return check pending (0/${itemGroups.length})`}
                    </Chip>
                  </div>
                  <p className="text-xs text-foreground/50 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                    Check off each item as it reaches the shop from the venue. Accessible to both staff & owner.
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <Button
                    size="sm"
                    variant="flat"
                    color="success"
                    radius="sm"
                    onPress={markAllReturned}
                    className="font-medium text-xs h-8"
                  >
                    Check all returned ✓
                  </Button>
                  {returnedCount > 0 && (
                    <Button
                      size="sm"
                      variant="light"
                      color="default"
                      radius="sm"
                      onPress={uncheckAllReturned}
                      className="text-xs h-8 text-foreground/60"
                    >
                      Reset all
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 pt-1 no-print">
                <Button
                  size="sm"
                  radius="full"
                  variant={itemFilter === "all" ? "solid" : "bordered"}
                  color={itemFilter === "all" ? "primary" : "default"}
                  className="h-7 text-xs"
                  onPress={() => setItemFilter("all")}
                >
                  All ({itemGroups.length})
                </Button>
                <Button
                  size="sm"
                  radius="full"
                  variant={itemFilter === "remaining" ? "solid" : "bordered"}
                  color={itemFilter === "remaining" ? "warning" : "default"}
                  className="h-7 text-xs"
                  onPress={() => setItemFilter("remaining")}
                >
                  Remaining to bring ({remainingCount})
                </Button>
                <Button
                  size="sm"
                  radius="full"
                  variant={itemFilter === "returned" ? "solid" : "bordered"}
                  color={itemFilter === "returned" ? "success" : "default"}
                  className="h-7 text-xs"
                  onPress={() => setItemFilter("returned")}
                >
                  Returned ({returnedCount})
                </Button>
              </div>

              {/* Interactive Item Checklist */}
              <div className="divide-y divide-content3 border border-content3 rounded-lg overflow-hidden bg-content2/30">
                {displayedItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-foreground/50">
                    No items in this filter view.
                  </div>
                ) : (
                  displayedItems.map(({ line, index }) => {
                    const isChecked = isItemFullyReturned(line, index);
                    const { label, qty } = parseItemLine(line);
                    const totalQty = getItemTotalQty(qty);
                    const returnedQty = getReturnedQty(line, index);
                    const isMultiQty = totalQty > 1;
                    const isPartial = returnedQty > 0 && returnedQty < totalQty;
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
                          isChecked
                            ? "bg-success/5 text-foreground/80"
                            : isPartial
                              ? "bg-warning/5 text-foreground"
                              : "bg-transparent text-foreground"
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer select-none flex-1"
                          onClick={() => toggleItemReturn(line, index)}
                        >
                          <Checkbox
                            isSelected={isChecked}
                            isIndeterminate={isPartial}
                            onValueChange={() => toggleItemReturn(line, index)}
                            color="success"
                            size="md"
                            aria-label={`Mark ${line} as returned`}
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0">
                            <span
                              className={`text-sm font-medium ${
                                isChecked ? "line-through text-foreground/50" : "text-foreground"
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMultiQty ? (
                            /* Qty stepper for items with qty > 1 */
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                aria-label="Decrease returned qty"
                                disabled={returnedQty <= 0}
                                onClick={() => setReturnedQty(line, index, String(returnedQty - 1), totalQty)}
                                className="w-6 h-6 rounded-full border border-content3 flex items-center justify-center text-sm font-bold text-foreground/70 hover:bg-content3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                −
                              </button>
                              <span
                                className={`text-xs font-mono font-semibold min-w-[52px] text-center ${
                                  isChecked
                                    ? "text-success"
                                    : isPartial
                                      ? "text-warning"
                                      : "text-foreground/60"
                                }`}
                              >
                                {returnedQty}/{totalQty}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase returned qty"
                                disabled={returnedQty >= totalQty}
                                onClick={() => setReturnedQty(line, index, String(returnedQty + 1), totalQty)}
                                className="w-6 h-6 rounded-full border border-content3 flex items-center justify-center text-sm font-bold text-foreground/70 hover:bg-content3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <Chip
                              size="sm"
                              variant="flat"
                              color={isChecked ? "success" : "default"}
                              className="text-xs h-5 px-1.5 font-mono"
                            >
                              Qty: {totalQty}
                            </Chip>
                          )}
                          <Chip
                            size="sm"
                            variant="flat"
                            color={isChecked ? "success" : isPartial ? "warning" : "danger"}
                            className="text-[11px] h-5 hidden sm:inline-flex"
                          >
                            {isChecked ? "All returned" : isPartial ? `${totalQty - returnedQty} left` : "Not returned"}
                          </Chip>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Missing / Damaged Items Note Textbox */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <span>📝</span> Missing / Return Items Note
                  </label>
                  <span className="text-[11px] text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                    Both staff & owner can edit
                  </span>
                </div>
                <p className="text-xs text-foreground/50">
                  Note down anything missing, damaged at the venue, or items left behind to bring back later.
                </p>
                <Textarea
                  aria-label="Missing or return items note"
                  placeholder="e.g. 1 curry bucket was missing at venue, 1 table left behind to bring tomorrow morning..."
                  variant="bordered"
                  value={itemReturnNotes}
                  onValueChange={setItemReturnNotes}
                  minRows={2}
                />
              </div>

              {/* Quick Save in Return Check Section */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 no-print">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    radius="sm"
                    onPress={onSave}
                    isLoading={saving}
                    className="font-semibold text-xs h-8"
                  >
                    Save item check
                  </Button>
                  {savedAt && <span className="text-xs text-success">Saved.</span>}
                </div>

                {allReturned && orderCompletion !== "completed" && (
                  <Button
                    size="sm"
                    color="success"
                    variant="flat"
                    radius="sm"
                    onPress={() => setOrderCompletion("completed")}
                    className="text-xs h-8 font-semibold"
                  >
                    Mark work completion as completed ✓
                  </Button>
                )}
              </div>
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
                  {order.staffAssigned.map((s, i) => {
                    const money = assignmentMoney(s);
                    return (
                    <div key={i} className="flex items-center gap-1">
                      <Chip variant="flat" color={isOwner && money.status === "paid" ? "success" : "warning"}>
                        {s.name}
                        {isOwner ? ` — ₹${s.amount || 0}` : ""}
                        {isOwner && money.total > 0
                          ? money.status === "paid"
                            ? " · Paid"
                            : money.advances > 0
                              ? ` · Due ${inr(money.due)}`
                              : " · Due"
                          : ""}
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
                    );
                  })}
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
                  <Input
                    label="Investment (₹) — flowers/drinks/food"
                    type="number"
                    variant="bordered"
                    value={invoice.investment}
                    onValueChange={(v) => setInvoice({ ...invoice, investment: v })}
                    className="sm:col-span-2"
                  />
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div className="bg-primary/10 border border-primary/40 rounded-md px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
                      Due amount
                    </span>
                    <span className="text-xl text-warning" style={{ fontFamily: "var(--font-display)" }}>
                      ₹{due.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-success/10 border border-success/40 rounded-md px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
                      Profit (order − staff − investment)
                    </span>
                    <span
                      className={`text-xl ${profit < 0 ? "text-danger" : "text-success"}`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      ₹{profit.toLocaleString("en-IN")}
                    </span>
                  </div>
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

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between no-print">
        <BackButton href="/orders" label="Back to Orders" />
      </div>
    </div>
  );
}