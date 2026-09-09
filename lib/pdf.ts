"use client";

import { jsPDF } from "jspdf";
import type { Order } from "./types";
import { collectItemLines, mapsLinkForOrder } from "./orderDisplay";

const COLORS = {
  aubergine: [36, 17, 41] as [number, number, number],
  cream: [248, 244, 230] as [number, number, number],
  gold: [217, 164, 39] as [number, number, number],
  royal: [91, 38, 116] as [number, number, number],
  ochre: [139, 74, 21] as [number, number, number],
  leaf: [63, 107, 31] as [number, number, number],
};

const PAGE_WIDTH = 210;
const MARGIN = 14;
const BOTTOM_LIMIT = 275;

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo-new.png");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function addHeader(doc: jsPDF, title: string, orderId: string): Promise<number> {
  doc.setFillColor(...COLORS.aubergine);
  doc.rect(0, 0, PAGE_WIDTH, 30, "F");

  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, 5, 13, 19.5);
    } catch {
      // ignore malformed image, header still reads fine without it
    }
  }

  const textX = logo ? MARGIN + 17 : MARGIN;
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(16);
  doc.text("Anjaneya Decorations", textX, 14);
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.cream);
  doc.text("Tent House & Decoration - V.K.M - 9704452180", textX, 20.5);

  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(12);
  doc.text(title, PAGE_WIDTH - MARGIN, 12, { align: "right" });
  doc.setFontSize(10);
  doc.text(orderId, PAGE_WIDTH - MARGIN, 19, { align: "right" });

  return 40;
}

function ensureSpace(doc: jsPDF, y: number, needed = 8): number {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    return 20;
  }
  return y;
}

function writeLine(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setTextColor(...COLORS.aubergine);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "-", x + 32, y);
  return y + 6.5;
}

function sectionTitle(doc: jsPDF, text: string, y: number, color: [number, number, number]): number {
  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(text, MARGIN, y);
  doc.setFont("helvetica", "normal");
  return y + 7;
}

function writeItemList(doc: jsPDF, items: string[], y: number): number {
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.aubergine);
  if (items.length === 0) {
    doc.text("No items recorded yet.", MARGIN + 2, y);
    return y + 6;
  }
  items.forEach((line) => {
    y = ensureSpace(doc, y);
    doc.text(`\u2022 ${line}`, MARGIN + 2, y);
    y += 6;
  });
  return y;
}

/** Customer-facing invoice: full item list plus every amount/payment detail. */
export async function generateInvoicePdf(order: Order): Promise<void> {
  const doc = new jsPDF();
  let y = await addHeader(doc, "Invoice", order.id);

  y = sectionTitle(doc, "Customer", y, COLORS.royal);
  y = writeLine(doc, "Name", order.customer.name, MARGIN, y);
  y = writeLine(doc, "Phone", order.customer.phone, MARGIN, y);
  if (order.customer.address) y = writeLine(doc, "Address", order.customer.address, MARGIN, y);
  y = writeLine(doc, "Program", order.program.type || order.serviceType, MARGIN, y);
  y = writeLine(doc, "Event date", order.eventDate || "-", MARGIN, y);
  y += 3;

  y = sectionTitle(doc, "Items", y, COLORS.royal);
  y = writeItemList(doc, collectItemLines(order), y);
  y += 3;

  y = ensureSpace(doc, y, 40);
  doc.setDrawColor(...COLORS.gold);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  const total = parseFloat(order.invoice.totalAmount || "0") || 0;
  const advance = parseFloat(order.invoice.advancePaid || "0") || 0;
  const due = Math.max(total - advance, 0);

  y = sectionTitle(doc, "Payment", y, COLORS.royal);
  y = writeLine(doc, "Total amount", `Rs. ${total.toLocaleString("en-IN")}`, MARGIN, y);
  y = writeLine(doc, "Advance paid", `Rs. ${advance.toLocaleString("en-IN")}`, MARGIN, y);

  doc.setFillColor(...COLORS.gold);
  doc.setDrawColor(...COLORS.gold);
  y += 1;
  doc.roundedRect(MARGIN, y - 5, 90, 10, 1.5, 1.5, "S");
  doc.setTextColor(...COLORS.ochre);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Due amount: Rs. ${due.toLocaleString("en-IN")}`, MARGIN + 3, y + 1.5);
  doc.setFont("helvetica", "normal");
  y += 12;

  y = writeLine(doc, "Payment type", order.invoice.paymentType || "-", MARGIN, y);

  if (order.notes?.trim()) {
    y += 3;
    y = ensureSpace(doc, y, 20);
    y = sectionTitle(doc, "Notes", y, COLORS.royal);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.aubergine);
    const noteLines = doc.splitTextToSize(order.notes.trim(), PAGE_WIDTH - MARGIN * 2 - 2);
    noteLines.forEach((line: string) => {
      y = ensureSpace(doc, y);
      doc.text(line, MARGIN + 2, y);
      y += 5.5;
    });
    y += 1;
  }

  const link = mapsLinkForOrder(order);
  if (link) {
    y += 4;
    y = ensureSpace(doc, y, 10);
    doc.setTextColor(...COLORS.royal);
    doc.setFontSize(10);
    doc.textWithLink("View customer location on Google Maps", MARGIN, y, { url: link });
  }

  doc.save(`${order.id}-invoice.pdf`);
}

/** Builds the staff report doc without saving/downloading it — shared by the download and share-sheet entry points below. */
async function buildStaffReportDoc(order: Order): Promise<jsPDF> {
  const doc = new jsPDF();
  let y = await addHeader(doc, "Staff Report", order.id);

  y = sectionTitle(doc, "Customer", y, COLORS.leaf);
  y = writeLine(doc, "Name", order.customer.name, MARGIN, y);
  y = writeLine(doc, "Phone", order.customer.phone, MARGIN, y);
  if (order.customer.address) y = writeLine(doc, "Address", order.customer.address, MARGIN, y);
  y = writeLine(doc, "Program", order.program.type || order.serviceType, MARGIN, y);
  y = writeLine(doc, "Event date", order.eventDate || "-", MARGIN, y);
  y += 3;

  const link = mapsLinkForOrder(order);
  if (link) {
    doc.setTextColor(...COLORS.royal);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Location:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.textWithLink("Open in Google Maps", MARGIN + 22, y, { url: link });
    y += 8;
  }

  y = sectionTitle(doc, "Items to bring / set up", y, COLORS.leaf);
  y = writeItemList(doc, collectItemLines(order), y);
  y += 3;

  if (order.staffAssigned.length > 0) {
    y = ensureSpace(doc, y, 20);
    y = sectionTitle(doc, "Staff on this job", y, COLORS.leaf);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.aubergine);
    order.staffAssigned.forEach((s) => {
      y = ensureSpace(doc, y);
      // Deliberately no amount printed here.
      doc.text(`\u2022 ${s.name}`, MARGIN + 2, y);
      y += 6;
    });
  }

  if (order.notes?.trim()) {
    y += 3;
    y = ensureSpace(doc, y, 20);
    y = sectionTitle(doc, "Notes", y, COLORS.leaf);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.aubergine);
    const noteLines = doc.splitTextToSize(order.notes.trim(), PAGE_WIDTH - MARGIN * 2 - 2);
    noteLines.forEach((line: string) => {
      y = ensureSpace(doc, y);
      doc.text(line, MARGIN + 2, y);
      y += 5.5;
    });
  }

  return doc;
}

/**
 * Staff-facing job sheet: what to bring, where to go, who to contact.
 * Deliberately excludes money — total/advance/due are never printed here.
 */
export async function generateStaffReportPdf(order: Order): Promise<void> {
  const doc = await buildStaffReportDoc(order);
  doc.save(`${order.id}-staff-report.pdf`);
}

/**
 * Same staff report, but as a `File` instead of an auto-download — for handing
 * to the OS share sheet (`navigator.share`), which is the only way (without
 * WhatsApp's paid Business API) to send one PDF to *several* WhatsApp chats
 * from a single user action: the share sheet lets the person multi-select
 * every staff chat to forward to at once, inside WhatsApp's own UI.
 */
export async function getStaffReportPdfFile(order: Order): Promise<File> {
  const doc = await buildStaffReportDoc(order);
  const blob = doc.output("blob");
  return new File([blob], `${order.id}-staff-report.pdf`, { type: "application/pdf" });
}

/**
 * Combined multi-order PDF: one summary page listing every selected order
 * (with its own customer name, amount, and staff — owner view only for
 * money) plus the grand total and combined staff totals, followed by one
 * detail page per order (items, amount, staff). Orders no longer need to
 * share a customer — the summary just prints each order's customer name
 * next to it, and the header/filename fall back to "N orders" when the
 * selection spans more than one customer.
 */
export async function generateCombinedOrdersPdf(orders: Order[], isOwner: boolean): Promise<void> {
  if (orders.length === 0) return;
  const doc = new jsPDF();
  const uniqueNames = Array.from(new Set(orders.map((o) => o.customer.name || "Customer")));
  const headerLabel = uniqueNames.length === 1 ? uniqueNames[0] : `${orders.length} orders`;

  // ---- Page 1: summary ----
  let y = await addHeader(doc, "Combined Report", headerLabel);
  y = sectionTitle(doc, uniqueNames.length === 1 ? `Orders for ${uniqueNames[0]}` : "Selected orders", y, COLORS.royal);

  let grandTotal = 0;
  const staffTotals = new Map<string, number>();

  orders.forEach((order) => {
    y = ensureSpace(doc, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.aubergine);
    doc.text(`${order.id} — ${order.customer.name || "Customer"}`, MARGIN, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const total = parseFloat(order.invoice?.totalAmount || "0") || 0;
    if (isOwner) grandTotal += total;
    const line = [
      order.program.type || order.serviceType,
      `Date: ${order.eventDate || "-"}`,
      isOwner ? `Amount: Rs. ${total.toLocaleString("en-IN")}` : "",
      order.staffAssigned.length ? `Staff: ${order.staffAssigned.map((s) => s.name).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("   |   ");
    doc.text(line, MARGIN + 2, y);
    y += 7;

    order.staffAssigned.forEach((s) => {
      if (!isOwner) return;
      const amt = parseFloat(s.amount || "0") || 0;
      staffTotals.set(s.name, (staffTotals.get(s.name) || 0) + amt);
    });
  });

  y += 2;
  y = ensureSpace(doc, y, 20);
  doc.setDrawColor(...COLORS.gold);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  if (isOwner) {
    doc.setFillColor(...COLORS.gold);
    doc.setDrawColor(...COLORS.gold);
    doc.roundedRect(MARGIN, y - 5, 90, 10, 1.5, 1.5, "S");
    doc.setTextColor(...COLORS.ochre);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Grand total: Rs. ${grandTotal.toLocaleString("en-IN")}`, MARGIN + 3, y + 1.5);
    doc.setFont("helvetica", "normal");
    y += 14;
  }

  if (isOwner && staffTotals.size > 0) {
    y = sectionTitle(doc, "Staff — total across these orders", y, COLORS.royal);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.aubergine);
    Array.from(staffTotals.entries()).forEach(([name, amt]) => {
      y = ensureSpace(doc, y);
      doc.text(`\u2022 ${name}: Rs. ${amt.toLocaleString("en-IN")}`, MARGIN + 2, y);
      y += 6;
    });
  }

  // ---- One detail page per order ----
  orders.forEach((order) => {
    doc.addPage();
    let py = 20;
    doc.setTextColor(...COLORS.royal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${order.id} — ${order.customer.name}`, MARGIN, py);
    py += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.aubergine);
    py = writeLine(doc, "Program", order.program.type || order.serviceType, MARGIN, py);
    py = writeLine(doc, "Event date", order.eventDate || "-", MARGIN, py);
    py += 2;

    py = sectionTitle(doc, "Items", py, COLORS.leaf);
    py = writeItemList(doc, collectItemLines(order), py);
    py += 3;

    if (isOwner) {
      const total = parseFloat(order.invoice?.totalAmount || "0") || 0;
      const advance = parseFloat(order.invoice?.advancePaid || "0") || 0;
      const due = Math.max(total - advance, 0);
      py = sectionTitle(doc, "Payment", py, COLORS.royal);
      py = writeLine(doc, "Total amount", `Rs. ${total.toLocaleString("en-IN")}`, MARGIN, py);
      py = writeLine(doc, "Advance paid", `Rs. ${advance.toLocaleString("en-IN")}`, MARGIN, py);
      py = writeLine(doc, "Due amount", `Rs. ${due.toLocaleString("en-IN")}`, MARGIN, py);
      py += 2;
    }

    if (order.staffAssigned.length > 0) {
      py = ensureSpace(doc, py, 20);
      py = sectionTitle(doc, "Staff", py, COLORS.leaf);
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.aubergine);
      order.staffAssigned.forEach((s) => {
        py = ensureSpace(doc, py);
        doc.text(`\u2022 ${s.name}${isOwner ? ` — Rs. ${s.amount || 0}` : ""}`, MARGIN + 2, py);
        py += 6;
      });
    }
  });

  const filenameBase = uniqueNames.length === 1 ? uniqueNames[0].replace(/\s+/g, "-") : `orders-${orders.length}`;
  doc.save(`${filenameBase}-combined-orders.pdf`);
}