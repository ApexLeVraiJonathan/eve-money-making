"use client";

import { usePathname } from "next/navigation";
import { getActiveAppByPathname } from "@/app/apps.config";

export function ActiveAppName() {
  const pathname = usePathname();
  const app = getActiveAppByPathname(pathname ?? "/");
  return <span className="font-medium">{app.label}</span>;
}
