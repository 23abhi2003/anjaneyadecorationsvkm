"use client";

import { HeroUIProvider } from "@heroui/react";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/Auth";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider>
      <AuthProvider>{children}</AuthProvider>
    </HeroUIProvider>
  );
}