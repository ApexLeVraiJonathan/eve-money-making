"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/**
 * Automatically refreshes the NextAuth session before the EVE access token expires.
 *
 * This prevents token expiry during long-running admin tasks (like undercut checking)
 * by proactively calling getSession() to trigger the refresh logic in auth.ts.
 *
 * How it works:
 * - Reads session.expiresAt to know when the EVE token expires
 * - Schedules a refresh 3 minutes before expiry (safety window)
 * - Clears and reschedules whenever the session changes
 * - Works silently in the background without user interaction
 */
export function SessionRefreshBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only schedule refresh if authenticated and we have expiry info
    if (status !== "authenticated" || !session?.expiresAt) {
      return;
    }

    // Don't schedule if there's an error (let SessionStatusBanner handle it)
    if (session.error) {
      return;
    }

    const expiresAtMs = session.expiresAt;
    const nowMs = Date.now();

    // Refresh 3 minutes before expiry (180,000 ms)
    // This gives us a safety window in case of network delays
    const safetyWindowMs = 3 * 60 * 1000;
    const msUntilRefresh = expiresAtMs - nowMs - safetyWindowMs;

    // If token is already expired or expiring very soon, refresh immediately
    if (msUntilRefresh <= 0) {
      console.log(
        "[SessionRefresh] Token expiring soon, refreshing immediately",
      );
      update(); // Force session refresh
      return;
    }

    // Schedule the refresh
    console.log(
      `[SessionRefresh] Scheduling token refresh in ${Math.round(msUntilRefresh / 1000 / 60)} minutes`,
    );

    timerRef.current = setTimeout(() => {
      console.log("[SessionRefresh] Refreshing session proactively");
      update(); // This triggers the jwt callback in auth.ts which handles token refresh
    }, msUntilRefresh);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.expiresAt, session?.error, status, update]);

  return <>{children}</>;
}
