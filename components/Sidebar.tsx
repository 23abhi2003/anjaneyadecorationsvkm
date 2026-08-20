"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { NAV_ITEMS, CREATE_ORDER_ITEM } from "@/lib/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#F8F4E6]">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 py-6 border-b border-[#D9A427]/30"
      >
        <Image src="/logo.png" alt="Anjaneya Decorations logo" width={44} height={66} className="rounded-sm shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="text-base font-semibold text-[#8B4A15] truncate" style={{ fontFamily: "var(--font-display)" }}>
            Anjaneya Decorations
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#3F6B1F]" style={{ fontFamily: "var(--font-mono)" }}>
            Tent House &middot; V.K.M
          </p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname ?? "", item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-[#8B4A15]/10 text-[#8B4A15] font-semibold"
                  : "text-[#241129]/70 hover:bg-[#8B4A15]/5 hover:text-[#8B4A15]"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-2 border-t border-[#D9A427]/30">
        <Button
          as={Link}
          href={CREATE_ORDER_ITEM.href}
          onClick={onNavigate}
          color="primary"
          radius="sm"
          className="w-full font-semibold"
          startContent={<CREATE_ORDER_ITEM.icon size={18} />}
        >
          Create Order
        </Button>
      </div>
    </div>
  );
}