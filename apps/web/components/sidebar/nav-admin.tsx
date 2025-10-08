"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavAdmin({
  items,
}: {
  items: {
    name: string;
    url: string;
    icon: LucideIcon;
    items?: { name: string; url: string; icon?: LucideIcon }[];
  }[];
}) {
  const pathname = usePathname();
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    const activeParent = items
      .filter((it) => it.items?.length)
      .find(
        (it) =>
          pathname === it.url ||
          pathname.startsWith(`${it.url}/`) ||
          it.items?.some(
            (s) => pathname === s.url || pathname.startsWith(`${s.url}/`)
          )
      );
    setOpenKey(activeParent ? activeParent.url : null);
  }, [pathname, items]);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.name}
            asChild
            open={item.items?.length ? openKey === item.url : false}
            onOpenChange={(open) => setOpenKey(open ? item.url : null)}
          >
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={item.name}
                isActive={pathname === item.url}
              >
                <Link
                  href={item.url}
                  onClick={() => item.items?.length && setOpenKey(item.url)}
                >
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((sub) => {
                        const subActive =
                          pathname === sub.url ||
                          pathname.startsWith(`${sub.url}/`);
                        return (
                          <SidebarMenuSubItem key={sub.name}>
                            <SidebarMenuSubButton asChild isActive={subActive}>
                              <Link href={sub.url}>
                                <span>{sub.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
