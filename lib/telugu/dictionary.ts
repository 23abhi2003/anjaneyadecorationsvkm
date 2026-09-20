/**
 * English -> Telugu labels for the customer invoice PDF.
 *
 * Scope: this translates the invoice's fixed vocabulary — section headings,
 * field labels, and every known catalog term (tent sizes' labels, program
 * types, item categories, payment types, etc.) that can show up in
 * `collectItemLines(order)`. Free text the customer or staff actually typed
 * (customer name, address, notes, a custom "Others" program/flower value) is
 * left untouched — translating arbitrary typed text reliably would need a
 * live translation API, which is a separate feature from labeling the
 * invoice itself.
 */

export const LABELS_TE = {
  invoiceTitle: "ఇన్‌వాయిస్",
  tagline: "టెంట్ హౌస్ & డెకరేషన్",
  customer: "కస్టమర్",
  name: "పేరు",
  phone: "ఫోన్",
  address: "చిరునామా",
  program: "కార్యక్రమం",
  eventDate: "కార్యక్రమ తేదీ",
  items: "వస్తువులు",
  noItems: "ఇంకా ఏ వస్తువులు నమోదు కాలేదు.",
  payment: "చెల్లింపు",
  totalAmount: "మొత్తం సొమ్ము",
  advancePaid: "అడ్వాన్స్ చెల్లించినది",
  totalPaid: "మొత్తం చెల్లించినది",
  dueAmount: "బాకీ మొత్తం",
  paymentType: "చెల్లింపు విధానం",
  notes: "గమనికలు",
  mapsLink: "గూగుల్ మ్యాప్స్‌లో లొకేషన్ చూడండి",
  thankYou: "అంజనేయ డెకరేషన్స్‌ను ఎంచుకున్నందుకు ధన్యవాదాలు!",
  rupeePrefix: "రూ.",
  notAvailable: "-",
} as const;

/** Program types from lib/catalog.ts -> Telugu. */
export const PROGRAM_TYPES_TE: Record<string, string> = {
  Marriage: "వివాహం",
  Reception: "రిసెప్షన్",
  Haldi: "పసుపు కార్యక్రమం",
  Engagement: "నిశ్చితార్థం",
  Birthday: "పుట్టినరోజు",
  "21st Day": "21వ రోజు వేడుక",
  "Festival's": "పండుగలు",
  Seemantham: "సీమంతం",
  Lighting: "లైటింగ్",
  "DJ Event": "డీజే కార్యక్రమం",
  "Saree Function": "చీర కార్యక్రమం",
  Death: "అంత్యక్రియలు",
  "Death ": "అంత్యక్రియలు",
  Others: "ఇతరాలు",
};

/** Payment types from lib/catalog.ts -> Telugu. */
export const PAYMENT_TYPES_TE: Record<string, string> = {
  UPI: "యూపీఐ",
  Cash: "నగదు",
  Other: "ఇతరం",
};

/**
 * Item-line label fragments produced by `collectItemLines()` -> Telugu.
 * Matched as whole label tokens (the part before "—" or ":"); sizes/qty
 * values (e.g. "4x8", "20kg", "3") are left as-is since they're not
 * translatable words.
 */
export const ITEM_LABELS_TE: Record<string, string> = {
  Tent: "టెంట్",
  Baghoni: "బఘోని",
  Anda: "అండా",
  Lagan: "లగన్",
  "Tables, big": "పెద్ద టేబుళ్ళు",
  "Tables, small": "చిన్న టేబుళ్ళు",
  Chairs: "కుర్చీలు",
  "Rice dishes": "అన్నం ప్లేట్లు",
  "Rice spoons": "అన్నం చెంచాలు",
  "Curry buckets": "కూర బకెట్లు",
  "Curry spoons": "కూర చెంచాలు",
  "Curry donga": "కూర దొంగ",
  Kabgir: "కబ్గీర్",
  Jallithati: "జల్లితాటి",
  Jalligante: "జల్లిగంటె",
  Jugs: "జగ్గులు",
  Kanchudu: "కంచుడు",
  Stoves: "పొయ్యిలు",
  Stands: "స్టాండ్లు",
  Drums: "డ్రమ్ములు",
  "LED lights": "LED లైట్లు",
  "DJ boxes": "డీజే బాక్సులు",
  "Wooden tables": "చెక్క టేబుళ్ళు",
  Wireboxes: "వైర్‌బాక్సులు",
  Frame: "ఫ్రేమ్",
  Ceiling: "సీలింగ్",
  Pole: "పోల్",
  Flowers: "పూలు",
  Mats: "చాపలు",
  "Stage cloth": "స్టేజ్ క్లాత్",
  Sidewalls: "సైడ్‌వాల్స్",
};

/**
 * Translates one line from `collectItemLines(order)`, e.g. "Tent — 4x8: 2"
 * or "Rice dishes: 50". Only the recognized label portion is translated;
 * everything else (sizes, quantities, custom text) passes through unchanged.
 */
export function translateItemLine(line: string): string {
  const separators = [" — ", ": "];
  for (const sep of separators) {
    const idx = line.indexOf(sep);
    if (idx === -1) continue;
    const label = line.slice(0, idx);
    const rest = line.slice(idx + sep.length);
    const translatedLabel = ITEM_LABELS_TE[label];
    if (translatedLabel) {
      return `${translatedLabel}${sep}${rest}`;
    }
  }
  return line;
}

export function translateProgramType(type: string | undefined | null): string {
  if (!type) return LABELS_TE.notAvailable;
  return PROGRAM_TYPES_TE[type] || type;
}

export function translatePaymentType(type: string | undefined | null): string {
  if (!type) return LABELS_TE.notAvailable;
  return PAYMENT_TYPES_TE[type] || type;
}

/** Formats a rupee amount the way the Telugu invoice does: "రూ. 12,345". */
export function formatRupeesTe(amount: number): string {
  return `${LABELS_TE.rupeePrefix} ${amount.toLocaleString("en-IN")}`;
}