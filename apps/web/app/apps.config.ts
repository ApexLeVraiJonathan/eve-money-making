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
  Users,
  Zap,
  TrendingUp,
  ArrowLeftRight,
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
  id: "arbitrage" | "brokerage" | "characters" | "skill-issue";
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
    label: "Tradecraft",
    basePath: "/tradecraft",
    pathPrefixes: ["/tradecraft", "/market-tools"],
    icon: CircleDollarSign,
    navMain: [
      {
        title: "Overview",
        url: "/tradecraft",
        icon: CircleDollarSign,
      },
      {
        title: "Cycles",
        url: "/tradecraft/cycles",
        icon: Recycle,
      },
      {
        title: "Cycle Details",
        url: "/tradecraft/cycle-details",
        icon: TableOfContents,
      },
      {
        title: "Cycle History",
        url: "/tradecraft/cycle-history",
        icon: TableOfContents,
      },
      {
        title: "My Investments",
        url: "/tradecraft/my-investments",
        icon: PieChart,
      },
    ],
    admin: [
      {
        name: "Cycles",
        url: "/tradecraft/admin/cycles",
        icon: Recycle,
        items: [
          {
            name: "Manage Cycles",
            url: "/tradecraft/admin/cycles",
            icon: Recycle,
          },
          {
            name: "Cycle Intel",
            url: "/tradecraft/admin/cycleintel",
            icon: Recycle,
          },
          {
            name: "View Profit",
            url: "/tradecraft/admin/profit",
            icon: Recycle,
          },
          {
            name: "Packages",
            url: "/tradecraft/admin/packages",
            icon: Package,
          },
          {
            name: "Participations",
            url: "/tradecraft/admin/participations",
            icon: Users,
          },
          {
            name: "JingleYield",
            url: "/tradecraft/admin/jingle-yield",
            icon: BadgeDollarSign,
          },
        ],
      },
      {
        name: "Market Tools",
        url: "/tradecraft/admin/undercut-checker",
        icon: TrendingUp,
        items: [
          { name: "Planner", url: "/tradecraft/admin/planner", icon: Recycle },
          {
            name: "Undercut Checker",
            url: "/tradecraft/admin/undercut-checker",
            icon: Recycle,
          },
          {
            name: "Sell Appraiser",
            url: "/tradecraft/admin/sell-appraiser",
            icon: Recycle,
          },
          {
            name: "Arbitrage",
            url: "/tradecraft/admin/arbitrage",
            icon: ArrowLeftRight,
          },
          {
            name: "Liquidity",
            url: "/tradecraft/admin/liquidity",
            icon: TrendingUp,
          },
        ],
      },
      {
        name: "Operations",
        url: "/tradecraft/admin/users",
        icon: Package,
        items: [
          {
            name: "Characters",
            url: "/tradecraft/admin/characters",
            icon: UserCheck,
          },
          {
            name: "Caps",
            url: "/tradecraft/admin/users",
            icon: Users,
          },
        ],
      },
      {
        name: "Automation",
        url: "/tradecraft/admin/triggers",
        icon: Zap,
        items: [
          {
            name: "Triggers",
            url: "/tradecraft/admin/triggers",
            icon: Zap,
          },
        ],
      },
    ],
  },
  {
    id: "characters",
    label: "Characters",
    basePath: "/characters",
    pathPrefixes: ["/characters"],
    icon: Users,
    navMain: [
      {
        title: "Overview",
        url: "/characters",
        icon: Users,
      },
      {
        title: "Skills & Training",
        url: "",
        icon: NotebookPen,
        items: [
          { title: "Skill Browser", url: "/characters/skills/browser" },
          { title: "Training Overview", url: "/characters/skills" },
          { title: "Skill Plans", url: "/characters/skills/plans" },
        ],
      },
      {
        title: "Skill Farms",
        url: "/characters/skill-farms",
        icon: NotebookPen,
        items: [
          { title: "Characters", url: "/characters/skill-farms/characters" },
          { title: "Math", url: "/characters/skill-farms/math" },
          { title: "Tracking", url: "/characters/skill-farms/tracking" },
        ],
      },
    ],
  },
  {
    id: "skill-issue",
    label: "Skill-Issue",
    basePath: "/skill-issue",
    pathPrefixes: ["/skill-issue"],
    icon: Zap,
    navMain: [
      {
        title: "Fit Analysis",
        url: "/skill-issue",
        icon: Zap,
      },
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
