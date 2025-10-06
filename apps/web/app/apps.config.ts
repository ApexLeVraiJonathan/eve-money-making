import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  Handshake,
  TableOfContents,
  PieChart,
  Map,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: { title: string; url: string }[];
};

export type AdminItem = {
  name: string;
  url: string;
  icon: LucideIcon;
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
        title: "Dashboard",
        url: "/brokerage",
        icon: Handshake,
      },
      {
        title: "Consignments",
        url: "/brokerage/consignments",
        icon: Handshake,
        items: [
          { title: "All", url: "/brokerage/consignments" },
          { title: "New", url: "/brokerage/consignments/new" },
        ],
      },
      {
        title: "Reports",
        url: "/brokerage/reports",
        icon: PieChart,
      },
    ],
    admin: [
      { name: "Overview", url: "/admin", icon: TableOfContents },
      { name: "Commits", url: "/admin/commits", icon: PieChart },
      { name: "Settings", url: "/admin/settings", icon: Map },
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
        title: "Market Tools",
        url: "/arbitrage/market-tools",
        icon: CircleDollarSign,
        items: [
          {
            title: "Sell Appraiser",
            url: "/arbitrage/market-tools/sell-appraiser",
          },
          {
            title: "Undercut Checker",
            url: "/arbitrage/market-tools/undercut-checker",
          },
        ],
      },
    ],
    admin: [
      { name: "Overview", url: "/admin", icon: TableOfContents },
      { name: "Commits", url: "/admin/commits", icon: PieChart },
      { name: "Settings", url: "/admin/settings", icon: Map },
    ],
  },
];

export function getApps(): AppConfig[] {
  return APPS;
}

export function getActiveAppByPathname(pathname: string): AppConfig {
  const match = APPS.find((app) =>
    app.pathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
  return match ?? APPS[0];
}
