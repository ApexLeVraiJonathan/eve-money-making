"use client";

import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import type {
  LiquidityCheckRequest,
  LiquidityCheckResponse,
  LiquidityItemStatsRequest,
  LiquidityItemStatsResponse,
} from "@eve/shared/types";

/**
 * API hooks for liquidity analysis
 *
 * Backend: apps/api/src/market/liquidity.controller.ts
 */

// ============================================================================
// Mutations (both endpoints use POST)
// ============================================================================

/**
 * Check liquidity for items across tracked stations
 * Requires admin role
 */
export function useLiquidityCheck() {
  const client = useApiClient();

  return useMutation({
    mutationFn: (data: LiquidityCheckRequest) =>
      client.post<LiquidityCheckResponse>("/liquidity/check", data),
  });
}

/**
 * Get detailed liquidity stats for a specific item
 * Public endpoint
 */
export function useLiquidityItemStats() {
  const client = useApiClient();

  return useMutation({
    mutationFn: (data: LiquidityItemStatsRequest) =>
      client.post<LiquidityItemStatsResponse>("/liquidity/item-stats", data),
  });
}
