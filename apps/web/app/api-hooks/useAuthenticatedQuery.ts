"use client";

import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";

/**
 * Wrapper around useQuery that automatically waits for session to be ready
 *
 * This prevents the race condition where queries run before the user's
 * authentication token is available, causing 401 errors that get cached.
 *
 * Use this instead of useQuery for any queries that require authentication.
 *
 * @example
 * ```typescript
 * export function useCurrentUser() {
 *   const client = useApiClient();
 *   return useAuthenticatedQuery({
 *     queryKey: qk.users.me(),
 *     queryFn: () => client.get("/auth/me"),
 *   });
 * }
 * ```
 */
export function useAuthenticatedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "enabled"
  > & {
    /**
     * Additional enabled condition (will be combined with session check)
     * @example enabled: !!userId
     */
    enabled?: boolean;
  },
) {
  const { status } = useSession();

  return useQuery({
    ...options,
    // Combine session check with any additional enabled condition
    enabled: status !== "loading" && (options.enabled ?? true),
  });
}
