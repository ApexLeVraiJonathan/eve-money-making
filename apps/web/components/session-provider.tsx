"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      // Refetch session every 5 minutes as a backup to SessionRefreshBoundary
      refetchInterval={5 * 60}
      // Refetch when user returns to the tab (default behavior, made explicit)
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
