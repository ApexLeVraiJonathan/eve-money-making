"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  CleanupJobResponse,
  MarketTradesStalenessResponse,
  WalletsJobRunResponse,
} from "@eve/shared/tradecraft-ops";
export type { MarketTradesStalenessResponse } from "@eve/shared/tradecraft-ops";

/**
 * API hooks for background job monitoring
 *
 * Backend: apps/api/src/jobs/jobs.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get market staleness summary
 */
export function useMarketStaleness() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["jobs", "staleness"],
    queryFn: () =>
      client.post<MarketTradesStalenessResponse>("/jobs/staleness", {}),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Trigger ESI cache cleanup job (admin only)
 */
export function useCleanupEsiCache() {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.post<CleanupJobResponse>("/jobs/esi-cache/cleanup", {}),
  });
}

/**
 * Trigger OAuth state cleanup job (admin only)
 */
export function useCleanupOAuthState() {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.post<CleanupJobResponse>("/jobs/oauth-state/cleanup", {}),
  });
}

/**
 * Trigger wallet sync job (admin only)
 */
export function useRunWalletsJob() {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.post<WalletsJobRunResponse>("/jobs/wallets/run", {}),
  });
}
