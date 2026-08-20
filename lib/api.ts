/**
 * Base URL of the Cloudflare Worker backend (see the sibling `backend/`
 * project). Set NEXT_PUBLIC_API_URL at build time — e.g. in Cloudflare
 * Pages' "Environment variables" settings, or in `.env.local` for local dev.
 */
// export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787").replace(/\/$/, "");
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://anjaneyadecorations-api.vangaabhi766.workers.dev").replace(/\/$/, "");


/** fetch() against the Worker API. Usage mirrors the old same-origin `fetch("/api/...")` calls. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, init);
}
