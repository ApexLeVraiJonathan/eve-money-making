"use client";

import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
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
} from "@eve/ui";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();

  // Track which parent items are expanded; keep route-driven expansions additive
  // and do not collapse user-opened sections until they explicitly toggle them.
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  // Ensure the section that owns the current route is expanded, without
  // collapsing any sections the user opened manually.
  React.useEffect(() => {
    const autoOpenKeys = new Set<string>();

    items
      .filter((it) => it.items?.length)
      .forEach((it) => {
        const key = it.url || it.title;
        const hasUrl = Boolean(it.url);
        const matchesSelf =
          hasUrl && (pathname === it.url || pathname.startsWith(`${it.url}/`));
        const matchesChild = it.items?.some(
          (s) => pathname === s.url || pathname.startsWith(`${s.url}/`),
        );

        if (matchesSelf || matchesChild) {
          autoOpenKeys.add(key);
        }
      });

    if (autoOpenKeys.size > 0) {
      setOpenKeys((prev) => {
        const next = new Set(prev);
        autoOpenKeys.forEach((k) => next.add(k));
        return Array.from(next);
      });
    }
  }, [pathname, items]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Home</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = item.url || item.title;
          const isOpen = item.items?.length ? openKeys.includes(key) : false;

          return (
            <Collapsible
              key={item.title}
              asChild
              open={isOpen}
              onOpenChange={(open) =>
                setOpenKeys((prev) => {
                  const exists = prev.includes(key);
                  if (open && !exists) return [...prev, key];
                  if (!open && exists) return prev.filter((k) => k !== key);
                  return prev;
                })
              }
            >
              <SidebarMenuItem>
                {item.url ? (
                  <>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={
                        pathname === item.url &&
                        !item.items?.some(
                          (s) =>
                            pathname === s.url ||
                            pathname.startsWith(`${s.url}/`),
                        )
                      }
                    >
                      <Link
                        href={item.url}
                        onClick={() =>
                          item.items?.length &&
                          setOpenKeys((prev) =>
                            prev.includes(key) ? prev : [...prev, key],
                          )
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
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
                            {item.items?.map((subItem) => {
                              const subActive = pathname === subItem.url;
                              return (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={subActive}
                                  >
                                    <Link href={subItem.url}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <SidebarMenuButton
                      tooltip={item.title}
                      onClick={() =>
                        setOpenKeys((prev) =>
                          prev.includes(key)
                            ? prev.filter((k) => k !== key)
                            : [...prev, key],
                        )
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
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
                            {item.items?.map((subItem) => {
                              const subActive = pathname === subItem.url;
                              return (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={subActive}
                                  >
                                    <Link href={subItem.url}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </>
                    ) : null}
                  </>
                )}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
