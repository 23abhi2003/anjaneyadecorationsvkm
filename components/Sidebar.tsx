"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button, Tooltip } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import AutoRickshawIcon from "@/components/icons/AutoRickshawIcon";
import { NAV_ITEMS, AUTO_RIDE_ITEMS, CREATE_ORDER_ITEM, CREATE_RIDE_ITEM } from "@/lib/nav";
import { useAuth } from "@/lib/Auth";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/auto-rides") return pathname === "/auto-rides";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({
  onNavigate,
  collapsed = false,
  showBrand = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  showBrand?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver";
  const isStaff = user?.role === "staff";

  // Decoration items: owners and drivers/staff see non-ownerOnly items (Orders, Customers, Staff)
  const decorationItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);

  const isPilotOrStaff = isDriver || isStaff;

  // Auto Rides items:
  // - Owners see all subsections
  // - Pilots and Staff see Dashboard, Rides, Customers, and Pilot Fare
  const autoItems = AUTO_RIDE_ITEMS.filter((item) => {
    if (isOwner) return true;
    if (isPilotOrStaff) {
      return (
        item.href === "/auto-rides" ||
        item.href === "/auto-rides/rides" ||
        item.href === "/auto-rides/customers" ||
        item.href === "/auto-rides/drivers"
      );
    }
    return false;
  }).map((item) => {
    if (isPilotOrStaff) {
      if (item.href === "/auto-rides") return { ...item, label: "Dashboard" };
      if (item.href === "/auto-rides/rides") return { ...item, label: "Rides" };
      if (item.href === "/auto-rides/customers") return { ...item, label: "Customers" };
      if (item.href === "/auto-rides/drivers") return { ...item, label: "Pilot Fare" };
    }
    return item;
  });

  const isAutoRidesPath = (pathname ?? "").startsWith("/auto-rides");
  const [autoRidesOpen, setAutoRidesOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-[#F8F4E6]">
      {showBrand && (
        <Link
          href={isDriver ? "/auto-rides/rides" : "/"}
          onClick={onNavigate}
          className="flex items-center gap-3 px-5 py-6 border-b border-[#D9A427]/30"
        >
          <Image src="/logo-new.png" alt="Anjaneya Decorations logo" width={44} height={66} className="rounded-sm shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="text-base font-semibold text-[#8B4A15] truncate" style={{ fontFamily: "var(--font-display)" }}>
              Anjaneya Decorations
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#3F6B1F]" style={{ fontFamily: "var(--font-mono)" }}>
              {isDriver ? "Auto Rentals · V.K.M" : "Tent House · V.K.M"}
            </p>
          </div>
        </Link>
      )}

      <nav className={`flex-1 overflow-y-auto py-5 space-y-4 ${collapsed ? "px-2" : "px-3"}`}>
        {/* Decoration CMS Navigation (hidden for drivers) */}
        {decorationItems.length > 0 && (
          <div className="space-y-1">
            {decorationItems.map((item) => {
              const active = isActive(pathname ?? "", item.href);
              const Icon = item.icon;

              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-label={item.label}
                  className={`flex items-center gap-3 rounded-md text-sm transition-colors ${
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
                  } ${
                    active
                      ? "bg-[#8B4A15]/10 text-[#8B4A15] font-semibold"
                      : "text-[#241129]/70 hover:bg-[#8B4A15]/5 hover:text-[#8B4A15]"
                  }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (!collapsed) return <div key={item.href}>{link}</div>;

              return (
                <Tooltip key={item.href} content={item.label} placement="right" delay={200}>
                  {link}
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Auto Rides Section - Appears at the LAST of the sidebar (Owners and Drivers only, NOT staff) */}
        {autoItems.length > 0 && (
          <div className={`${decorationItems.length > 0 ? "pt-2 border-t border-[#D9A427]/30" : ""} space-y-1`}>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setAutoRidesOpen((prev) => !prev)}
                aria-expanded={autoRidesOpen}
                className="w-full px-3 pb-2 pt-1.5 flex items-center justify-between hover:bg-primary/10 rounded-md transition-colors cursor-pointer group text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#241129]/80 group-hover:text-[#8B4A15] flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
                  <div className="relative w-5 h-5 rounded-full overflow-hidden border border-[#D9A427] shrink-0 shadow-xs bg-[#241129]">
                    <Image
                      src="/vkm-auto-rides-logo.jpg"
                      alt="VKM Auto Rides"
                      fill
                      className="object-cover"
                    />
                  </div>
                  VKM Auto Rides
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-[#241129] font-medium font-mono">
                    VKM
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-primary transition-transform duration-200 ${
                      autoRidesOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>
            ) : (
              <div className="py-1 flex justify-center">
                <Tooltip content={autoRidesOpen ? "Collapse VKM Auto Rides" : "Expand VKM Auto Rides"} placement="right" delay={200}>
                  <button
                    type="button"
                    onClick={() => setAutoRidesOpen((prev) => !prev)}
                    className="p-1 rounded-md hover:bg-primary/10 transition-colors"
                  >
                    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[#D9A427] shadow-xs bg-[#241129]">
                      <Image
                        src="/vkm-auto-rides-logo.jpg"
                        alt="VKM Auto Rides"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </button>
                </Tooltip>
              </div>
            )}

            {/* Sub-items (Dropdown: only open on click) */}
            {autoRidesOpen && (
              <div className={!collapsed ? "pl-2 border-l-2 border-[#D9A427]/35 ml-3 space-y-1 mt-0.5" : "space-y-1"}>
                {autoItems.map((item) => {
                  const active = isActive(pathname ?? "", item.href);
                  const Icon = item.icon;

                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-label={item.label}
                      className={`flex items-center gap-3 rounded-md text-sm transition-colors ${
                        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"
                      } ${
                        active
                          ? "bg-primary/20 text-[#241129] font-bold shadow-sm"
                          : "text-[#241129]/70 hover:bg-primary/10 hover:text-[#241129]"
                      }`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <Icon size={17} className={`shrink-0 ${active ? "text-primary" : ""}`} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );

                  if (!collapsed) return <div key={item.href}>{link}</div>;

                  return (
                    <Tooltip key={item.href} content={item.label} placement="right" delay={200}>
                      {link}
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom CTA Button */}
      {(isOwner || isDriver || isStaff) && (
        <div className={`pb-5 pt-2 border-t border-[#D9A427]/30 ${collapsed ? "px-2" : "px-3"}`}>
          {isAutoRidesPath || isDriver ? (
            collapsed ? (
              <Tooltip content={CREATE_RIDE_ITEM.label} placement="right" delay={200}>
                <Button
                  as={Link}
                  href={CREATE_RIDE_ITEM.href}
                  onClick={onNavigate}
                  isIconOnly
                  color="warning"
                  radius="sm"
                  aria-label={CREATE_RIDE_ITEM.label}
                  className="w-full text-white bg-[#8B4A15]"
                >
                  <CREATE_RIDE_ITEM.icon size={18} />
                </Button>
              </Tooltip>
            ) : (
              <Button
                as={Link}
                href={CREATE_RIDE_ITEM.href}
                onClick={onNavigate}
                color="warning"
                radius="sm"
                className="w-full font-semibold text-white bg-[#8B4A15]"
                startContent={<CREATE_RIDE_ITEM.icon size={18} />}
              >
                Create Ride
              </Button>
            )
          ) : (
            collapsed ? (
              <Tooltip content={CREATE_ORDER_ITEM.label} placement="right" delay={200}>
                <Button
                  as={Link}
                  href={CREATE_ORDER_ITEM.href}
                  onClick={onNavigate}
                  isIconOnly
                  color="primary"
                  radius="sm"
                  aria-label={CREATE_ORDER_ITEM.label}
                  className="w-full"
                >
                  <CREATE_ORDER_ITEM.icon size={18} />
                </Button>
              </Tooltip>
            ) : (
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
            )
          )}
        </div>
      )}
    </div>
  );
}