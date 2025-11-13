"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * Shows a loading state during initial session check
 * Prevents flash of unauthenticated content (FOUC)
 */
export function AuthLoadingBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  // Show loading spinner while NextAuth checks for existing session
  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Session ready - render the app
  return <>{children}</>;
}
