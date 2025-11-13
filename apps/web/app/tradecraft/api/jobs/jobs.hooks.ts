"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

/**
 * API hooks for background job monitoring
 *
 * Backend: apps/api/src/jobs/jobs.controller.ts
 */

// ============================================================================
// Types
// ============================================================================

export type MarketStaleness = {
  stations: Array<{
    stationId: number;
    stationName: string;
    lastUpdate: string | null;
    ageHours: number | null;
    isStale: boolean;
  }>;
  overallStaleness: {
    avgAgeHours: number;
    maxAgeHours: number;
    staleCount: number;
    totalCount: number;
  };
};

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
      client.get<{
        lastRun: string | null;
        isRunning: boolean;
        nextRun: string | null;
      }>("/jobs/status"),
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
      client.post<{ cleaned: number }>("/jobs/esi-cache/cleanup", {}),
  });
}

/**
 * Trigger OAuth state cleanup job (admin only)
 */
export function useCleanupOAuthState() {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.post<{ cleaned: number }>("/jobs/oauth-state/cleanup", {}),
  });
}

/**
 * Trigger wallet sync job (admin only)
 */
export function useRunWalletsJob() {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.get<{
        ok: boolean;
        buysAllocated: number;
        sellsAllocated: number;
      }>("/jobs/wallets/run"),
  });
}
