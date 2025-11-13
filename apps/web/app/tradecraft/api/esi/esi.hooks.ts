"use client";

import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

/**
 * API hooks for ESI (EVE Swagger Interface) operations
 *
 * Backend: apps/api/src/esi/esi.controller.ts
 */

// ============================================================================
// Types
// ============================================================================

export type EsiMetrics = {
  cacheHitMem: number;
  cacheHitDb: number;
  cacheMiss: number;
  http200: number;
  http304: number;
  http401: number;
  http420: number;
  memCacheSize: number;
  inflightSize: number;
  effectiveMaxConcurrency: number;
  errorRemain: number | null;
  errorResetAt: number | null;
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Get ESI API metrics and cache statistics
 */
export function useEsiMetrics() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["esi", "metrics"],
    queryFn: () => client.get<EsiMetrics>("/esi/metrics"),
    // Refetch every 30 seconds since metrics change frequently
    refetchInterval: 30000,
  });
}
