"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

export default function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#F8F4E6] border-b-2 border-double border-[#D9A427]/50">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="p-2 -ml-2 rounded-md text-[#8B4A15] hover:bg-[#8B4A15]/10 active:bg-[#8B4A15]/15"
      >
        <Menu size={22} />
      </button>
      <Link href="/" className="flex items-center gap-2 min-w-0">
        <Image src="/logo.png" alt="Anjaneya Decorations logo" width={32} height={48} className="rounded-sm shrink-0" />
        <p className="text-sm font-semibold text-[#8B4A15] truncate" style={{ fontFamily: "var(--font-display)" }}>
          Anjaneya Decorations
        </p>
      </Link>
    </div>
  );
}