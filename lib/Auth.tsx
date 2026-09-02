"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, AUTH_STORAGE_KEY } from "@/lib/api";
import type { Role } from "@/lib/types";

export interface AuthUser {
  staffId?: string;
  name?: string;
  phone: string;
  role: Role;
}

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  /** True until the stored session (if any) has been read from localStorage. */
  loading: boolean;
  /** Standard sign-in with role + phone + PIN, checked against the backend. */
  login: (role: Role, phone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  /** Signs in directly from a token (e.g. `?token=...` on a shared link). Verifies with the backend. */
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: StoredSession): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  async function login(role: Role, phone: string, pin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone: phone.trim(), pin: pin.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        return { ok: false, error: data.error || "Invalid phone number or PIN." };
      }
      const session: StoredSession = { token: data.token, user: data.user };
      persistSession(session);
      setToken(session.token);
      setUser(session.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach the server. Check your connection and try again." };
    }
  }

  async function loginWithToken(candidateToken: string): Promise<boolean> {
    try {
      const res = await apiFetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      if (!res.ok) return false;
      const data = (await res.json().catch(() => ({}))) as { user?: AuthUser };
      if (!data.user) return false;
      const session: StoredSession = { token: candidateToken, user: data.user };
      persistSession(session);
      setToken(session.token);
      setUser(session.user);
      return true;
    } catch {
      return false;
    }
  }

  function logout(): void {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within an <AuthProvider>.");
  return ctx;
}
