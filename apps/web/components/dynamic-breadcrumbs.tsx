"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getActiveAppByPathname, getApps } from "@/app/apps.config";

function buildTitleLookup(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const app of getApps()) {
    for (const item of app.navMain) {
      map[item.url] = item.title;
      if (item.items) {
        for (const sub of item.items) {
          map[sub.url] = sub.title;
        }
      }
    }
    if (app.admin) {
      for (const adm of app.admin) {
        map[adm.url] = adm.name;
      }
    }
  }
  return map;
}

function prettify(segment: string): string {
  return segment
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

export function DynamicBreadcrumbs() {
  const pathname = usePathname() ?? "/";
  const app = getActiveAppByPathname(pathname);
  if (!app) return null;
  const titleLookup = buildTitleLookup();

  // Remove query/hash and app base path
  const cleanPath = pathname.split(/[?#]/)[0];
  const rel = cleanPath.startsWith(app.basePath)
    ? cleanPath.slice(app.basePath.length)
    : cleanPath;

  const segments = rel.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null; // At app root, header already shows the app name
  }

  const crumbs = segments.map((seg, idx) => {
    const href = `${app.basePath}/${segments.slice(0, idx + 1).join("/")}`;
    const label = titleLookup[href] ?? prettify(seg);
    return { href, label };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            <BreadcrumbItem>
              {i < crumbs.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {i < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
