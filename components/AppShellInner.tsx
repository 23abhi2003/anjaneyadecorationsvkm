"use client";

import { useState, type ReactNode } from "react";
import Providers from "@/app/providers";
import Sidebar from "@/components/Sidebar";
import MobileTopBar from "@/components/MobileTopBar";
import MobileDrawer from "@/components/MobileDrawer";

/**
 * Loaded via next/dynamic(..., { ssr: false }) from AppShell.tsx. That's
 * deliberate: this is a static-export SPA that fetches everything from the
 * Worker API at runtime, so nothing here needs (or benefits from) server
 * rendering — and keeping it out of the Node-side prerender pass avoids an
 * SSR incompatibility between @heroui/react/framer-motion and Next's
 * static-export prerenderer.
 */
export default function AppShellInner({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Providers>
      <div className="md:flex md:min-h-screen">
        {/* Desktop fixed sidebar */}
        <aside className="hidden md:block md:w-64 md:shrink-0 md:border-r md:border-[#D9A427]/30">
          <div className="md:fixed md:inset-y-0 md:w-64">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile top bar + drawer */}
        <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} />
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
    </Providers>
  );
}