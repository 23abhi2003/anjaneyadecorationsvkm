/**
 * Base URL of the Cloudflare Worker backend (see the sibling `backend/`
 * project). Set NEXT_PUBLIC_API_URL at build time — e.g. in Cloudflare
 * Pages' "Environment variables" settings, or in `.env.local` for local dev.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://anjaneyadecorations-api.vangaabhi766.workers.dev").replace(/\/$/, "");
// export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787").replace(/\/$/, "");

/** localStorage key the signed-in user is persisted under. No token anymore — just who you are. */
export const AUTH_STORAGE_KEY = "anjaneya_auth";

interface StoredUser {
  role?: string;
  staffId?: string; 
}

function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: StoredUser };
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * fetch() against the Worker API. Usage mirrors the old same-origin `fetch("/api/...")` calls.
 *
 * There's no bearer token anymore — login just checks credentials once and
 * the frontend remembers who's signed in. Every request resends that
 * identity as plain headers (`X-User-Role` / `X-User-Staff-Id`) so the
 * backend can still apply its existing business rules (hide invoice amounts
 * from staff, owner-only actions, etc). This is NOT a security boundary —
 * anyone could set these headers by hand — it's just enough for the normal
 * app UI to behave the way it did before, without the token machinery that
 * kept causing 401s.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = getStoredUser();
  const headers = new Headers(init.headers);
  if (user?.role && !headers.has("X-User-Role")) {
    headers.set("X-User-Role", user.role);
  }
  if (user?.staffId && !headers.has("X-User-Staff-Id")) {
    headers.set("X-User-Staff-Id", user.staffId);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}