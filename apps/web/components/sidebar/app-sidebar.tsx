"use client";

import * as React from "react";
import {
  LifeBuoy,
  Send,
  TableOfContents,
  type LucideIcon,
  Cog,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavAdmin } from "@/components/sidebar/nav-admin";
import { NavSecondary } from "@/components/sidebar/nav-secondary";
import { NavUser } from "@/components/sidebar/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@eve/ui";
import { Button } from "@eve/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eve/ui";
import { getApps, getActiveAppByPathname } from "@/app/apps.config";

const data = {
  navSecondary: [
    {
      title: "Account Settings",
      url: "/account-settings",
      icon: Cog,
    },
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
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await res.json()) as { role?: string };
        if (!cancel) setIsAdmin((body.role ?? "USER") === "ADMIN");
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
        <div className="px-2 py-2">
          <div className="flex flex-col items-start gap-2 overflow-hidden">
            <Link href="/" className="inline-flex items-center">
              <div className="relative h-8 w-[120px]">
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
                  className="h-8 gap-2 w-full justify-start"
                >
                  {(() => {
                    const Icon: LucideIcon = (activeApp?.icon ??
                      TableOfContents) as LucideIcon;
                    return <Icon className="h-4 w-4 shrink-0" />;
                  })()}
                  <span className="text-sm">
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
