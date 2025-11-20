import * as React from "react";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@eve/ui";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url?: string;
    icon: LucideIcon;
    onClick?: () => void;
    customButton?: React.ReactNode;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.customButton ? (
                item.customButton
              ) : item.onClick ? (
                <SidebarMenuButton size="sm" onClick={item.onClick}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : item.url && item.url !== "#" ? (
                <SidebarMenuButton asChild size="sm">
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton size="sm" disabled>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
