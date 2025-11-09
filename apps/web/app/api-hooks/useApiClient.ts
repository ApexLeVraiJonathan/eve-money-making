"use client";

import { useSession } from "next-auth/react";
import { clientForApp } from "@eve/api-client";

/**
 * Hook to get an API client with automatic authentication
 * 
 * This hook integrates with NextAuth to automatically inject the access token
 * into requests. The client also sends cookies for session-based auth fallback.
 * 
 * Usage:
 * ```tsx
 * const client = useApiClient();
 * const { data } = useQuery({
 *   queryKey: ['users'],
 *   queryFn: () => client.get<User[]>('/users')
 * });
 * ```
 */
export function useApiClient() {
  const { data: session } = useSession();
  return clientForApp("api", session?.accessToken as string | undefined);
}

