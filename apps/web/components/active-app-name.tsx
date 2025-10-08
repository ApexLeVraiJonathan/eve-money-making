"use client";

import { usePathname } from "next/navigation";
import { getActiveAppByPathname } from "@/app/apps.config";

export function ActiveAppName() {
  const pathname = usePathname();
  const app = getActiveAppByPathname(pathname ?? "/");
  if (!app) return null;
  return <span className="font-medium">{app.label}</span>;
}
