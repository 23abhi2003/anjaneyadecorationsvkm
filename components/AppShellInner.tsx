"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import Providers from "@/app/providers";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileDrawer from "@/components/MobileDrawer";
import { useAuth } from "@/lib/Auth";

const SIDEBAR_COLLAPSED_KEY = "anjaneya_sidebar_collapsed";

/**
 * Everything that depends on auth/router state lives inside <Providers>, so it
 * can reach useAuth(). Split out from AppShellInner so AppShellInner itself
 * stays a thin, dynamic-import-safe wrapper (see AppShell.tsx for why).
 */
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted collapse preference after mount (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage unavailable — fall back to expanded.
    }
  }, []);

  function toggleCollapsed(): void {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore write failures (private browsing, etc.)
      }
      return next;
    });
  }

  const isLoginRoute = pathname === "/login";

  // Route guard: bounce signed-out visitors to /login, and signed-in visitors away from it.
  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginRoute) {
      router.replace("/login");
    } else if (user && isLoginRoute) {
      router.replace("/");
    }
  }, [loading, user, isLoginRoute, router]);

  // The login page renders its own full-screen layout — no sidebar/header chrome.
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // While the session is being resolved (or a redirect is in flight), show a
  // minimal loading state instead of flashing protected content.
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#241129]">
        <Spinner color="primary" label="Loading..." labelColor="foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        collapsed={collapsed}
        onToggleSidebar={toggleCollapsed}
        onOpenMobileMenu={() => setDrawerOpen(true)}
        user={user}
        onLogout={logout}
      />

      <div className="md:flex md:flex-1 md:min-h-0">
        {/* Desktop fixed/collapsible sidebar */}
        <aside
          className={`hidden md:block md:shrink-0 md:border-r md:border-[#D9A427]/30 transition-[width] duration-200 ease-in-out ${
            collapsed ? "md:w-[76px]" : "md:w-64"
          }`}
        >
          <Sidebar collapsed={collapsed} showBrand={false} />
        </aside>

        {/* Mobile drawer (includes its own brand header) */}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* Content column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
          <footer
            className="max-w-6xl w-full mx-auto px-4 sm:px-6 pb-8 text-xs text-[#F8F4E6]/60"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Anjaneya Decorations · Tent House &amp; Decoration &middot; VKM · 9704452180
          </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * Loaded via next/dynamic(..., { ssr: false }) from AppShell.tsx. That's
 * deliberate: this is a static-export SPA that fetches everything from the
 * Worker API at runtime, so nothing here needs (or benefits from) server
 * rendering — and keeping it out of the Node-side prerender pass avoids an
 * SSR incompatibility between @heroui/react/framer-motion and Next's
 * static-export prerenderer.
 */
export default function AppShellInner({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}