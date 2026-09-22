import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ClipboardList, Users, HardHat, PlusCircle, Receipt, BarChart3, TrendingUp } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only shown to owner-role logins (financial/reporting pages). */
  ownerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Staff", href: "/staff", icon: HardHat },
  { label: "Invoices", href: "/invoices", icon: Receipt, ownerOnly: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Staff Analytics", href: "/staff-analytics", icon: TrendingUp, ownerOnly: true },
];

export const CREATE_ORDER_ITEM: NavItem = {
  label: "Create Order",
  href: "/orders/new",
  icon: PlusCircle,
};