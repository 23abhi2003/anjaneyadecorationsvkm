import type { Customer, Order } from "@/lib/types";
import { apiFetch } from "@/lib/api";

export interface ContactDirectoryItem {
  fullName: string;
  mainName: string;
  parenthetical: string;
  phone: string;
  referredBy: string;
  source: "order" | "customer";
}

export interface NameSuggestion {
  name: string;
  phone: string;
  subtext?: string;
}

export interface ReferralSuggestion {
  referName: string;
  phone: string;
  subtext?: string;
}

let cachedDirectory: ContactDirectoryItem[] | null = null;
let directoryPromise: Promise<ContactDirectoryItem[]> | null = null;

function normalize(s: string | undefined | null): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

/**
 * Builds an indexed list of contact entries from orders and customer records.
 */
export function buildContactDirectory(
  customers: Customer[] = [],
  orders: Order[] = []
): ContactDirectoryItem[] {
  const items: ContactDirectoryItem[] = [];

  function add(name: string, phone: string, ref: string, source: "order" | "customer") {
    const rawName = normalize(name);
    const cleanPhone = normalize(phone);
    const rawRef = normalize(ref);
    if (!rawName && !rawRef) return;

    const pMatch = rawName.match(/^(.*?)\s*\((.*?)\)\s*$/);
    const mainName = pMatch ? normalize(pMatch[1]) : rawName;
    const parenthetical = pMatch ? normalize(pMatch[2]) : "";

    items.push({
      fullName: rawName,
      mainName,
      parenthetical,
      phone: cleanPhone,
      referredBy: rawRef,
      source,
    });
  }

  orders.forEach((o) => {
    if (o.customer) {
      add(o.customer.name, o.customer.phone, o.customer.referredBy || "", "order");
    }
  });

  customers.forEach((c) => {
    add(c.name, c.phone, c.referredBy || "", "customer");
  });

  return items;
}

/**
 * Loads directory from the API and caches it in memory.
 */
export async function loadCustomerDirectory(forceRefresh = false): Promise<ContactDirectoryItem[]> {
  if (cachedDirectory && !forceRefresh) {
    return cachedDirectory;
  }

  if (directoryPromise && !forceRefresh) {
    return directoryPromise;
  }

  directoryPromise = (async () => {
    try {
      const [custRes, ordRes] = await Promise.all([
        apiFetch("/api/customers").catch(() => null),
        apiFetch("/api/orders").catch(() => null),
      ]);

      const customers: Customer[] = custRes && custRes.ok ? await custRes.json() : [];
      const orders: Order[] = ordRes && ordRes.ok ? await ordRes.json() : [];

      const dir = buildContactDirectory(customers, orders);
      cachedDirectory = dir;
      return dir;
    } catch {
      return cachedDirectory || [];
    } finally {
      directoryPromise = null;
    }
  })();

  return directoryPromise;
}

/**
 * Searches for customer names when typing in the "Customer name" field.
 * Matches customer names, parenthetical aliases, referral names, or phone numbers.
 */
export function searchCustomerNames(
  contacts: ContactDirectoryItem[],
  query: string,
  maxResults = 7
): NameSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const qDigits = q.replace(/\D/g, "");
  const results: NameSuggestion[] = [];
  const seenNames = new Set<string>();

  for (const c of contacts) {
    const matchFullName = c.fullName.toLowerCase().includes(q);
    const matchMainName = c.mainName.toLowerCase().includes(q);
    const matchParen = c.parenthetical.toLowerCase().includes(q);
    const matchRef = c.referredBy.toLowerCase().includes(q);
    const cleanPhone = c.phone.replace(/\D/g, "");
    const matchPhone = qDigits.length >= 3 && cleanPhone.includes(qDigits);

    if (matchFullName || matchMainName || matchParen || matchRef || matchPhone) {
      // 1. If customer name matched or phone matched
      const targetName = c.mainName || c.fullName;
      const keyName = targetName.toLowerCase();
      if ((matchFullName || matchMainName || matchPhone) && !seenNames.has(keyName)) {
        seenNames.add(keyName);
        results.push({
          name: targetName,
          phone: c.phone,
          subtext: c.referredBy ? `Ref: ${c.referredBy}` : c.parenthetical ? `Alias: ${c.parenthetical}` : undefined,
        });
      }

      // 2. If parenthetical matched (e.g. "suresh mama" from "Adda youth (suresh mama)")
      if (c.parenthetical && matchParen) {
        const keyParen = c.parenthetical.toLowerCase();
        if (!seenNames.has(keyParen)) {
          seenNames.add(keyParen);
          results.push({
            name: c.parenthetical,
            phone: c.phone,
            subtext: `Contact in: ${targetName}`,
          });
        }
      }

      // 3. If referredBy matched (e.g. user typed "suresh" and Suresh was the referrer)
      if (c.referredBy && matchRef) {
        const keyRef = c.referredBy.toLowerCase();
        if (!seenNames.has(keyRef)) {
          seenNames.add(keyRef);
          results.push({
            name: c.referredBy,
            phone: c.phone,
            subtext: `Ref in: ${targetName}`,
          });
        }

        // Also add the associated customer name if not yet listed
        if (!seenNames.has(keyName)) {
          seenNames.add(keyName);
          results.push({
            name: targetName,
            phone: c.phone,
            subtext: `Referred by: ${c.referredBy}`,
          });
        }
      }
    }

    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Searches for referral names when typing in the "Referred by" field.
 * Matches past referral names, parenthetical contact names, or previous customer names.
 */
export function searchReferralNames(
  contacts: ContactDirectoryItem[],
  query: string,
  maxResults = 7
): ReferralSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const qDigits = q.replace(/\D/g, "");
  const results: ReferralSuggestion[] = [];
  const seenRefs = new Set<string>();

  for (const c of contacts) {
    const matchRef = c.referredBy.toLowerCase().includes(q);
    const matchParen = c.parenthetical.toLowerCase().includes(q);
    const matchName = c.mainName.toLowerCase().includes(q);
    const cleanPhone = c.phone.replace(/\D/g, "");
    const matchPhone = qDigits.length >= 3 && cleanPhone.includes(qDigits);

    // 1. Direct match on referredBy
    if (c.referredBy && (matchRef || matchPhone)) {
      const key = c.referredBy.toLowerCase();
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push({
          referName: c.referredBy,
          phone: c.phone,
          subtext: `Order: ${c.mainName || c.fullName}`,
        });
      }
    }

    // 2. Match on parenthetical alias (e.g. "suresh mama")
    if (c.parenthetical && (matchParen || matchPhone)) {
      const key = c.parenthetical.toLowerCase();
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push({
          referName: c.parenthetical,
          phone: c.phone,
          subtext: `From: ${c.mainName || c.fullName}`,
        });
      }
    }

    // 3. Match on customer name (in case a customer referred this order)
    if (matchName || (matchPhone && c.referredBy)) {
      const key = c.mainName.toLowerCase();
      if (!seenRefs.has(key)) {
        seenRefs.add(key);
        results.push({
          referName: c.mainName,
          phone: c.phone,
          subtext: "Past customer",
        });
      }
    }

    if (results.length >= maxResults) break;
  }

  return results;
}
