"use client";

import * as React from "react";
import { clientForApp, type ApiClient, type AppId } from "@eve/api-client";

/**
 * Hook to get an API client that always sends the browser's cookies
 * (including the backend session cookie) with each request).
 *
 * The client instance is memoized so that components can safely use it
 * inside `useCallback` / `useEffect` dependencies without causing
 * infinite re-fetch loops.
 */
function inferAppIdFromPathname(pathname: string): AppId {
  if (pathname.startsWith("/tradecraft")) return "tradecraft";
  if (pathname.startsWith("/characters")) return "characters";
  return "core";
}

export function useApiClient(appId?: AppId): ApiClient {
  const client = React.useMemo(() => {
    const resolvedAppId =
      appId ??
      (typeof window !== "undefined"
        ? inferAppIdFromPathname(window.location.pathname)
        : "core");
    return clientForApp(resolvedAppId);
  }, [appId]);
  return client;
}
