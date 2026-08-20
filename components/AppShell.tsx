"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const AppShellInner = dynamic(() => import("@/components/AppShellInner"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#241129]" />,
});

export default function AppShell({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
