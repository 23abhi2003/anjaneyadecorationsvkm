import type { Order } from "./types";

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
      ["Rice dishes", t.riceDishes],
      ["Rice spoons", t.riceSpoons],
      ["Curry buckets", t.curryBuckets],
      ["Curry spoons", t.currySpoons],
      ["Curry donga", t.curryDonga],
      ["Kabgir", t.kabgir],
      ["Jallithati", t.jallithati],
      ["Stoves", t.stoveType],
      ["Stands", t.stands],
      ["Drums", t.drums],
      ["LED lights", t.ledLights],
      ["DJ boxes", t.djBoxes],
      ["Wooden tables", t.woodenTables],
    ];
    extras.filter(([, v]) => v).forEach(([k, v]) => lines.push(`${k}: ${v}`));
  }

  if (order.decoration) {
    const d = order.decoration;
    flatten(d.frames).forEach((l) => lines.push(`Frame — ${l}`));
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
  }

  return lines;
}
