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
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the stored session (if any) has been read from localStorage. */
  loading: boolean;
  /** Standard sign-in with phone + PIN, checked against the backend. Role is auto-detected server-side. */
  login: (phone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.user) return null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setUser(stored.user);
    }
    setLoading(false);
  }, []);

  async function login(phone: string, pin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        return { ok: false, error: data.error || "Invalid phone number or PIN." };
      }
      const session: StoredSession = { user: data.user };
      persistSession(session);
      setUser(session.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach the server. Check your connection and try again." };
    }
  }

  function logout(): void {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within an <AuthProvider>.");
  return ctx;
}