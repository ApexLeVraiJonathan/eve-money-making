"use client";

import { clientForApp } from "@eve/api-client";

/**
 * Hook to get an API client that always sends the browser's cookies
 * (including the backend session cookie) with each request.
 */
export function useApiClient() {
  return clientForApp("api");
}
