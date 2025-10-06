"use client";

import * as React from "react";
import {
  BookOpen,
  Bot,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  TableOfContents,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
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

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="inline-flex items-center">
              <img
                src="/Full%20logo%20Dark.svg"
                alt="EVE Money Making"
                className="h-8 w-auto"
              />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 w-28 justify-start"
                >
                  <activeApp.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm truncate">{activeApp.label}</span>
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
        <NavMain items={activeApp.navMain} />
        {activeApp.admin ? <NavAdmin items={activeApp.admin} /> : null}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
