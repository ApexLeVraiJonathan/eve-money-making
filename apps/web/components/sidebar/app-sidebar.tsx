"use client";

import * as React from "react";
import { LifeBuoy, Send, TableOfContents, type LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavAdmin } from "@/components/sidebar/nav-admin";
import { NavSecondary } from "@/components/sidebar/nav-secondary";
import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getApps, getActiveAppByPathname } from "@/app/apps.config";

const data = {
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const apps = getApps();
  const activeApp = getActiveAppByPathname(pathname ?? "/");
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/characters", { cache: "no-store" });
        const body = (await res.json()) as {
          characters?: Array<{ role?: string }>;
        };
        const admin = (body.characters ?? []).some((c) => c.role === "ADMIN");
        if (!cancel) setIsAdmin(admin);
      } catch {
        if (!cancel) setIsAdmin(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="inline-flex items-center">
              <div className="relative" style={{ width: 120, height: 32 }}>
                <Image
                  src="/Full%20logo%20Dark.svg"
                  alt="EVE Money Making"
                  fill
                  sizes="120px"
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 w-28 justify-start"
                >
                  {(() => {
                    const Icon: LucideIcon = (activeApp?.icon ??
                      TableOfContents) as LucideIcon;
                    return <Icon className="h-4 w-4 shrink-0" />;
                  })()}
                  <span className="text-sm truncate">
                    {activeApp?.label ?? "Choose app"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-64">
                <DropdownMenuLabel>Apps</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {apps.map((app) => (
                  <DropdownMenuItem key={app.id} asChild>
                    <Link
                      href={app.basePath}
                      className="flex items-center gap-2"
                    >
                      <app.icon className="h-4 w-4" />
                      <span>{app.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {activeApp ? <NavMain items={activeApp.navMain} /> : null}
        {activeApp?.admin && isAdmin ? (
          <NavAdmin items={activeApp.admin} />
        ) : null}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
