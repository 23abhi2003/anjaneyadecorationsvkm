"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button, Link as HLink } from "@heroui/react";
import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <Navbar
      maxWidth="xl"
      height="5.5rem"
      className="bg-[#F8F4E6] border-b-4 border-double border-[#D9A427]/50"
      classNames={{ wrapper: "px-6 py-2" }}
    >
      <NavbarBrand as={Link} href="/" className="flex items-center gap-3">
        <Image src="/logo.png" alt="Anjaneya Decorations logo" width={56} height={84} className="rounded-sm" />
        <div className="leading-tight">
          <p className="text-xl md:text-2xl font-semibold text-[#8B4A15]" style={{ fontFamily: "var(--font-display)" }}>
            Anjaneya Decorations
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-[#3F6B1F]" style={{ fontFamily: "var(--font-mono)" }}>
            Tent House &middot; V.K.M
          </p>
        </div>
      </NavbarBrand>
      <NavbarContent justify="end" className="gap-4">
        <NavbarItem>
          <HLink as={Link} href="/" className="text-sm text-[#241129]/70" style={{ fontFamily: "var(--font-mono)" }}>
            Dashboard
          </HLink>
        </NavbarItem>
        <NavbarItem>
          <HLink as={Link} href="/orders" className="text-sm text-[#241129]/70" style={{ fontFamily: "var(--font-mono)" }}>
            Orders
          </HLink>
        </NavbarItem>
        <NavbarItem>
          <HLink as={Link} href="/customers" className="text-sm text-[#241129]/70" style={{ fontFamily: "var(--font-mono)" }}>
            Customers
          </HLink>
        </NavbarItem>
        <NavbarItem>
          <HLink as={Link} href="/staff" className="text-sm text-[#241129]/70" style={{ fontFamily: "var(--font-mono)" }}>
            Staff
          </HLink>
        </NavbarItem>
        <NavbarItem>
          <Button as={Link} href="/orders/new" color="primary" radius="sm" className="font-semibold">
            + Create Order
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
