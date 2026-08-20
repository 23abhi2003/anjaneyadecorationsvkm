import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Anjaneya Decorations — V.K.M",
  description: "Order, decoration, and staff management for Anjaneya Decorations, VKM.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="font-body bg-[#241129] min-h-screen text-foreground"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
