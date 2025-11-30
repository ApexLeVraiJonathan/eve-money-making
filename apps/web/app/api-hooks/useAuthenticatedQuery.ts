"use client";

import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";

/**
 * Thin wrapper around `useQuery` that keeps the same API but allows callers
 * to optionally control when the query is enabled. Authentication is handled
 * by the backend via cookies; unauthenticated responses (401/403) should be
 * handled in the `queryFn` (e.g. by mapping to `null` or `[]`).
 */
export function useAuthenticatedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryKey"
  > & {
    queryKey: TQueryKey;
    enabled?: boolean;
  },
) {
  return useQuery({
    ...options,
    enabled: options.enabled ?? true,
  });
}
