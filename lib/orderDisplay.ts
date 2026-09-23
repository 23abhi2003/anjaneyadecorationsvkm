import type { Order } from "./types";

/**
 * Normalizes a saved phone number into the digits-only form wa.me expects.
 * A bare 10-digit local number is assumed Indian and gets `91` prefixed;
 * anything already longer (has a country code) is left as-is.
 */
export function waDigits(phone: string | undefined | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Builds a `wa.me` deep link that opens a chat with a pre-filled message. No API key or token involved — this just opens WhatsApp (app or web) the same way a person clicking the link by hand would. */
export function waLink(phone: string | undefined | null, message: string): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Message sent to an assigned staff member's WhatsApp when the owner taps
 * "Send" on an order. Includes today's date (the date the message was sent,
 * not the event date) since the notebook spec called that out specifically.
 * The staff report PDF itself can't be attached through a wa.me link (that
 * would need the paid WhatsApp Business API), so the flow is: download the
 * PDF, then open this chat and attach it by hand — same "manual, no token"
 * pattern as the existing customer WhatsApp share.
 */
export function buildStaffWhatsAppMessage(order: Order, staffName: string): string {
  const sentDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const link = mapsLinkForOrder(order);
  const lines = [
    `Anjaneya Decorations — ${order.id}`,
    `Hi ${staffName}, you're assigned to this job:`,
    `Customer: ${order.customer?.name || "-"}`,
    `Program: ${order.program?.type || order.serviceType}`,
    `Event date: ${order.eventDate || "-"}`,
    order.customer?.address ? `Address: ${order.customer.address}` : "",
    link ? `Location: ${link}` : "",
    `Sent: ${sentDate}`,
    `— the staff report PDF is attached separately.`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function mapsLinkForOrder(order: Order): string | null {
  const loc = order.customer.location;
  if (loc) {
    return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  }
  if (order.customer.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`;
  }
  return null;
}

function flatten(obj?: Record<string, string>): string[] {
  return Object.entries(obj ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
}

/** Collects a flat, human-readable list of every item/qty on an order, regardless of shape. */
export function collectItemLines(order: Order): string[] {
  const lines: string[] = [];

  if (order.legacyItems?.length) {
    order.legacyItems.forEach((i) => lines.push(`${i.label}: ${i.qty}`));
  }

  if (order.tenthouse) {
    const t = order.tenthouse;
    flatten(t.tents).forEach((l) => lines.push(`Tent — ${l}`));
    Object.entries(t.bowls || {}).forEach(([type, obj]) => {
      flatten(obj).forEach((l) => lines.push(`${type} — ${l}`));
    });
    const extras: Array<[string, string]> = [
      ["Tables, big", t.tablesBig],
      ["Tables, small", t.tablesSmall],
      ["Chairs", t.chairs],
      ["Rice dishes", t.riceDishes],
      ["Rice spoons", t.riceSpoons],
      ["Curry buckets", t.curryBuckets],
      ["Curry spoons", t.currySpoons],
      ["Curry donga", t.curryDonga],
      ["Kabgir", t.kabgir],
      ["Jallithati", t.jallithati],
      ["Jalligante", t.jalligante],
      ["Jugs", t.jugs],
      ["Kanchudu", t.kanchudu],
      ["Stoves", t.stoveType],
      ["Stands", t.stands],
      ["Drums", t.drums],
      ["LED lights", t.ledLights],
      ["DJ boxes", t.djBoxes],
      ["Wooden tables", t.woodenTables],
      ["Wireboxes", t.wireboxes],
    ];
    extras.filter(([, v]) => v).forEach(([k, v]) => lines.push(`${k}: ${v}`));
    flatten(t.utensilsExtra).forEach((l) => lines.push(`Utensil — ${l}`));
    flatten(t.extrasExtra).forEach((l) => lines.push(`Item — ${l}`));
  }

  if (order.decoration) {
    const d = order.decoration;
    flatten(d.frames).forEach((l) => lines.push(`Frame — ${l}`));
    flatten(d.fiberItems).forEach((l) => lines.push(`Fiber item — ${l}`));
    flatten(d.ceiling).forEach((l) => lines.push(`Ceiling — ${l}`));
    flatten(d.ceilingPoles).forEach((l) => lines.push(`Pole — ${l}`));
    flatten(d.flowers).forEach((l) => lines.push(`Flowers — ${l}`));
    const stageCloth = [d.stageClothType, d.stageClothColor, d.stageClothQty].filter(Boolean).join(" / ");
    const extras: Array<[string, string]> = [
      ["Wooden tables", d.woodenTables],
      ["Mats", d.mats],
      ["Stage cloth", stageCloth],
      ["DJ boxes", d.djBoxes],
      ["LED lights", d.ledLights],
      ["Sidewalls", d.sidewalls],
    ];
    extras.filter(([, v]) => v).forEach(([k, v]) => lines.push(`${k}: ${v}`));
    flatten(d.framesExtra).forEach((l) => lines.push(`Item — ${l}`));
  }

  return lines;
}