"use client";

import * as React from "react";
import { ChevronsUpDown, LogIn } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type LinkedCharacter = {
  characterId: number;
  characterName: string;
};

export function NavUser() {
  const { isMobile } = useSidebar();
  const [characters, setCharacters] = React.useState<LinkedCharacter[] | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/auth/characters", { cache: "no-store" });
        const body = (await res.json()) as { characters?: LinkedCharacter[] };
        if (!cancelled) setCharacters(body.characters ?? []);
      } catch {
        if (!cancelled) setCharacters([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = () => {
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
    const returnUrl =
      typeof window !== "undefined" ? window.location.href : "/";
    const url = `${base}/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = url;
  };

  // Not linked yet → show sign-in button
  if (!loading && (characters == null || characters.length === 0)) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Button className="w-full" onClick={handleLogin} size="lg">
            <LogIn className="h-4 w-4" />
            <span className="ml-2">Sign in with EVE</span>
          </Button>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            Loading...
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const primary = characters![0];
  const initials = primary.characterName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage alt={primary.characterName} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {primary.characterName}
                </span>
                <span className="truncate text-xs">
                  Character #{primary.characterId}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={primary.characterName} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {primary.characterName}
                  </span>
                  <span className="truncate text-xs">
                    Character #{primary.characterId}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogin}>
              Link another character
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
