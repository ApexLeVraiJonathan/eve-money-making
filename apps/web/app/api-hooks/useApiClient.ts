"use client";

import * as React from "react";
import { clientForApp, type ApiClient } from "@eve/api-client";

/**
 * Hook to get an API client that always sends the browser's cookies
 * (including the backend session cookie) with each request).
 *
 * The client instance is memoized so that components can safely use it
 * inside `useCallback` / `useEffect` dependencies without causing
 * infinite re-fetch loops.
 */
export function useApiClient(): ApiClient {
  const client = React.useMemo(() => clientForApp("api"), []);
  return client;
}
