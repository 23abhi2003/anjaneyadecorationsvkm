import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ClipboardList, Users, HardHat, PlusCircle } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Staff", href: "/staff", icon: HardHat },
];

export const CREATE_ORDER_ITEM: NavItem = {
  label: "Create Order",
  href: "/orders/new",
  icon: PlusCircle,
};