import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  Handshake,
  TableOfContents,
  PieChart,
  Map,
  Package,
  Home,
  Recycle,
  UserCheck,
  BadgeDollarSign,
  NotebookPen,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: { title: string; url: string }[];
};

export type AdminSubItem = {
  name: string;
  url: string;
  icon?: LucideIcon;
};

export type AdminItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  items?: AdminSubItem[];
};

export type AppConfig = {
  id: "arbitrage" | "brokerage";
  label: string;
  basePath: string;
  // Any path that should mark this app as active
  pathPrefixes: string[];
  icon: LucideIcon;
  navMain: NavItem[];
  admin?: AdminItem[];
};

export const APPS: AppConfig[] = [
  {
    id: "brokerage",
    label: "Brokerage",
    basePath: "/brokerage",
    pathPrefixes: ["/brokerage"],
    icon: Handshake,
    navMain: [
      {
        title: "Overview",
        url: "/brokerage",
        icon: Home,
      },
      {
        title: "Consignments",
        url: "/brokerage/consignments",
        icon: Package,
        items: [
          { title: "New", url: "/brokerage/consignments/new" },
          { title: "Details", url: "/brokerage/consignments/details" },
        ],
      },
      {
        title: "Reports",
        url: "/brokerage/reports",
        icon: PieChart,
      },
    ],
    admin: [
      { name: "Overview", url: "/brokerage/admin", icon: TableOfContents },
      { name: "Commits", url: "/brokerage/admin/commits", icon: PieChart },
      { name: "Settings", url: "/brokerage/admin/settings", icon: Map },
    ],
  },
  {
    id: "arbitrage",
    label: "Arbitrage",
    basePath: "/arbitrage",
    pathPrefixes: ["/arbitrage", "/market-tools"],
    icon: CircleDollarSign,
    navMain: [
      {
        title: "Overview",
        url: "/arbitrage",
        icon: CircleDollarSign,
      },
      {
        title: "Cycles",
        url: "/arbitrage/cycles",
        icon: Recycle,
        items: [
          { title: "Opt-in", url: "/arbitrage/cycles/opt-in" },
          { title: "Details", url: "/arbitrage/cycles/details" },
          { title: "History", url: "/arbitrage/cycles/history" },
        ],
      },
      {
        title: "Reports",
        url: "/arbitrage/reports",
        icon: PieChart,
      },
    ],
    admin: [
      { name: "Overview", url: "/arbitrage/admin", icon: Home },
      {
        name: "Cycles",
        url: "/arbitrage/admin/cycles",
        icon: Recycle,
        items: [
          { name: "Planner", url: "/arbitrage/admin/planner", icon: Recycle },
          { name: "Commits", url: "/arbitrage/admin/commits", icon: Recycle },
          {
            name: "Undercut Checker",
            url: "/arbitrage/admin/undercut-checker",
            icon: Recycle,
          },
          {
            name: "Sell Appraiser",
            url: "/arbitrage/admin/sell-appraiser",
            icon: Recycle,
          },
        ],
      },
      {
        name: "Characters",
        url: "/arbitrage/admin/characters",
        icon: UserCheck,
      },
      {
        name: "Transactions",
        url: "/arbitrage/admin/transactions",
        icon: BadgeDollarSign,
      },
      { name: "Ledger", url: "/arbitrage/admin/ledger", icon: NotebookPen },
    ],
  },
];

export function getApps(): AppConfig[] {
  return APPS;
}

export function getActiveAppByPathname(pathname: string): AppConfig | null {
  const match = APPS.find((app) =>
    app.pathPrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ),
  );
  return match ?? null;
}
