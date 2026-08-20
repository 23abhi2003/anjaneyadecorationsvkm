"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Menu, PanelLeftClose, PanelLeftOpen, LifeBuoy, LogOut } from "lucide-react";
import type { AuthUser } from "@/lib/Auth";

export default function Header({
  collapsed,
  onToggleSidebar,
  onOpenMobileMenu,
  user,
  onLogout,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const displayName = user?.name?.trim() || user?.phone || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 bg-[#F8F4E6] border-b-2 border-double border-[#D9A427]/50">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="md:hidden p-2 -ml-1 rounded-md text-[#8B4A15] hover:bg-[#8B4A15]/10 active:bg-[#8B4A15]/15"
      >
        <Menu size={22} />
      </button>

      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:inline-flex p-2 -ml-1 rounded-md text-[#8B4A15] hover:bg-[#8B4A15]/10 active:bg-[#8B4A15]/15"
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      <Link href="/" className="flex items-center gap-2 min-w-0">
        <Image src="/logo-new.png" alt="Anjaneya Decorations logo" width={60} height={90} className="rounded-sm shrink-0" />
        <span
          className="inline text-xl sm:text-2xl font-semibold text-[#8B4A15] truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Anjaneya Decorations V.K.M
        </span>
      </Link>

      <div className="flex-1" />

      <a
        href="mailto:anjaneyadecors766@gmail.com"
        className="hidden sm:inline-flex items-center gap-1.5 text-sm text-[#241129]/70 hover:text-[#8B4A15] px-2.5 py-1.5 rounded-md hover:bg-[#8B4A15]/5 transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <LifeBuoy size={17} />
        Support
      </a>

      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#D9A427] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4E6]"
          >
            <Avatar
              name={initial}
              size="sm"
              classNames={{ base: "bg-[#8B4A15] text-[#F8F4E6] font-semibold" }}
            />
          </button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Account">
          <DropdownItem key="whoami" isReadOnly textValue={displayName} className="cursor-default opacity-100 data-[hover=true]:bg-transparent">
            <p className="text-sm font-semibold text-[#241129]">{user?.name || "Signed in"}</p>
            <p className="text-xs text-[#241129]/50" style={{ fontFamily: "var(--font-mono)" }}>
              {user?.phone}
            </p>
          </DropdownItem>
          <DropdownItem key="support" href="mailto:anjaneyadecors766@gmail.com" className="sm:hidden" startContent={<LifeBuoy size={16} />}>
            Support
          </DropdownItem>
          <DropdownItem
            key="logout"
            color="danger"
            className="text-danger"
            startContent={<LogOut size={16} />}
            onPress={onLogout}
          >
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </header>
  );
}