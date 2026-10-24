export interface ScannedFlowerItem {
  name: string;
  qty: string;
  amount: string;
}

export interface ScanFlowersResult {
  items: ScannedFlowerItem[];
  totalAmount: string;
  languageDetected?: string;
  rawText?: string;
}

const STORAGE_KEY = "gemini_api_key";

export function getGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  try {
    return (window.localStorage.getItem(STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    if (key.trim()) {
      window.localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Common flowers in Andhra Pradesh / Telangana for quick insertion / fallback.
 */
export const COMMON_TELUGU_FLOWERS: Array<{ name: string; te: string }> = [
  { name: "Chrysanthemum (చామంతి)", te: "చామంతి" },
  { name: "Marigold (బంతి)", te: "బంతి" },
  { name: "Rose / Gulabi (గులాబీ)", te: "గులాబీ" },
  { name: "Jasmine (మల్లెలు)", te: "మల్లెలు" },
  { name: "Lily (లిల్లీ)", te: "లిల్లీ" },
  { name: "Gerbera / Aster (గెర్బెరా)", te: "గెర్బెరా" },
  { name: "Daisy (డేజీ)", te: "డేజీ" },
  { name: "Crossandra (కనకాంబరం)", te: "కనకాంబరం" },
  { name: "Orchid (ఆర్కిడ్)", te: "ఆర్కిడ్" },
];

/**
 * Calls Gemini Vision API directly from the client to extract flower items and amounts
 * from a handwritten or printed receipt/chit in Telugu or English.
 */
export async function scanFlowersFromImage(dataUrl: string, userApiKey?: string): Promise<ScanFlowersResult> {
  const apiKey = (userApiKey || getGeminiApiKey()).trim();
  if (!apiKey) {
    throw new Error("Gemini API key is required. Please provide an API key to scan receipts.");
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format. Expected a base64 data URL.");
  }
  const mimeType = match[1] || "image/jpeg";
  const base64Data = match[2];

  const prompt = `You are an expert OCR & extraction system for an Indian event decoration business in Andhra Pradesh / Telangana.
Analyze this photo of a flower market bill, slip, receipt, or handwritten chit.
The text may be handwritten or printed in Telugu script (e.g. చామంతి, బంతి, గులాబీ/రోజా, మల్లెలు, లిల్లీ, కనకాంబరం, మొదలైనవి), English, or mixed Telugu-English with numbers, units (kg, bunch, katta, pcs), and prices/rates in Rupees (₹).

Extract:
1. Each flower item's name. If it is in Telugu, provide both the Telugu name and the English name, e.g. "చామంతి (Chrysanthemum)", "గులాబీ (Rose)", "బంతి (Marigold)", "మల్లెలు (Jasmine)", "లిల్లీ (Lily)". If in English, keep it in English.
2. The quantity / description (e.g. "10 kg", "2 bunches", "5 kattalu", "100 pcs", "1 box").
3. The amount in Rupees (numbers only, e.g. "1200", "500").
4. The total sum amount in Rupees.

Return ONLY a valid JSON object matching this structure:
{
  "items": [
    { "name": "Flower name in Telugu and English", "qty": "Quantity with unit", "amount": "1200" }
  ],
  "totalAmount": "Total amount in Rupees",
  "languageDetected": "Telugu" | "English" | "Mixed Telugu & English"
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  };

  // Try gemini-2.5-flash first, fall back to gemini-1.5-flash or gemini-2.0-flash if needed
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("No text returned by Gemini Vision model.");
      }

      // Clean possible markdown code fences
      const cleanJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleanJson);

      const items: ScannedFlowerItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: { name?: unknown; qty?: unknown; amount?: unknown }) => ({
            name: String(it.name || "Flower item").trim(),
            qty: String(it.qty || "").trim(),
            amount: String(it.amount || "").replace(/[^\d.]/g, "").trim(),
          }))
        : [];

      // Calculate total if not provided
      let totalAmount = String(parsed.totalAmount || "").replace(/[^\d.]/g, "").trim();
      if (!totalAmount && items.length > 0) {
        const sum = items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
        if (sum > 0) totalAmount = String(sum);
      }

      return {
        items,
        totalAmount,
        languageDetected: parsed.languageDetected || "Telugu & English",
        rawText,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If it's an auth error or invalid argument, don't keep retrying other models
      if (lastError.message.includes("API_KEY_INVALID") || lastError.message.includes("401") || lastError.message.includes("403")) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Failed to scan receipt image with Gemini.");
}
