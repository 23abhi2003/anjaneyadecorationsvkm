/**
 * Base URL of the Cloudflare Worker backend (see the sibling `backend/`
 * project). Set NEXT_PUBLIC_API_URL at build time — e.g. in Cloudflare
 * Pages' "Environment variables" settings, or in `.env.local` for local dev.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://anjaneyadecorations-api.vangaabhi766.workers.dev").replace(/\/$/, "");
// export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787").replace(/\/$/, "");



/** localStorage key the auth session (token + user) is persisted under. */
export const AUTH_STORAGE_KEY = "anjaneya_auth";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * fetch() against the Worker API. Usage mirrors the old same-origin `fetch("/api/...")` calls.
 * Automatically attaches the signed-in user's bearer token (if any) so call sites don't each
 * need to know about auth.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
