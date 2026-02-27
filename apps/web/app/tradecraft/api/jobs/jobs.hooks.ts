"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  CleanupJobResponse,
  JobStatusResponse,
  MarketStaleness,
  WalletsJobRunResponse,
} from "@eve/shared/tradecraft-ops";
export type { MarketStaleness } from "@eve/shared/tradecraft-ops";

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
    queryFn: () => client.get<MarketStaleness>("/jobs/staleness"),
  });
}

/**
 * Get job status
 */
export function useJobStatus() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["jobs", "status"],
    queryFn: () =>
      client.get<JobStatusResponse>("/jobs/status"),
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
      client.get<WalletsJobRunResponse>("/jobs/wallets/run"),
  });
}
