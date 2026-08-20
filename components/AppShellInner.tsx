"use client";

import type { ReactNode } from "react";
import Providers from "@/app/providers";
import SiteHeader from "@/components/SiteHeader";

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
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      <footer
        className="max-w-6xl mx-auto px-6 pb-10 text-xs text-[#F8F4E6]/60"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Anjaneya Decorations · Tent House &amp; Decoration &middot; VKM · 9704452180
      </footer>
    </Providers>
  );
}
