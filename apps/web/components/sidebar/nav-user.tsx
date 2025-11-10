"use client";

import * as React from "react";
import { ChevronsUpDown, LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@eve/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eve/ui";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@eve/ui";
import { Button } from "@eve/ui";
import { useMyCharacters } from "@/app/api-hooks/users";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: characters, isLoading: loading } = useMyCharacters();

  const handleLogin = () => {
    // Use NextAuth to sign in with EVE Online
    void signIn("eveonline", {
      callbackUrl: typeof window !== "undefined" ? window.location.href : "/",
    });
  };

  // Not linked yet → show sign-in button
  if (!loading && (!characters || characters.length === 0)) {
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

  // Use primary character if available, otherwise first character
  const primary = characters?.find((c) => c.isPrimary) ?? characters?.[0];
  
  if (!primary) {
    return null; // Safety check
  }
  const initials = primary.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  // EVE character portrait URL (public ESI Image Server)
  const portraitUrl = `https://image.eveonline.com/Character/${primary.id}_128.jpg`;

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
                <AvatarImage src={portraitUrl} alt={primary.name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{primary.name}</span>
                <span className="truncate text-xs">
                  Character #{primary.id}
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
                  <AvatarImage src={portraitUrl} alt={primary.name} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{primary.name}</span>
                  <span className="truncate text-xs">
                    Character #{primary.id}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogin}>
              Link another character
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
