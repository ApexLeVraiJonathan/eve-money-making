"use client";

import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type { EsiMetrics } from "@eve/shared/tradecraft-ops";
export type { EsiMetrics } from "@eve/shared/tradecraft-ops";

/**
 * API hooks for ESI (EVE Swagger Interface) operations
 *
 * Backend: apps/api/src/esi/esi.controller.ts
 */

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
