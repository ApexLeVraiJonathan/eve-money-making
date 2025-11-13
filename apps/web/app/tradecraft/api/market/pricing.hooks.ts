"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { qk } from "@eve/api-client/queryKeys";

/**
 * API hooks for pricing operations
 *
 * Backend: apps/api/src/market/pricing.controller.ts
 */

// ============================================================================
// Mutations
// ============================================================================

/**
 * Sell appraise - Get sell estimates for items
 */
export function useSellAppraise() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: { destinationStationId: number; lines: string[] }) =>
      client.post<{
        totalEstimatedIsk: string;
        items: Array<{
          typeId: number;
          typeName: string;
          quantity: number;
          bestSellPrice: number;
          totalValue: string;
          stationId: number;
          stationName: string;
        }>;
      }>("/pricing/sell-appraise", data),
  });
}

/**
 * Sell appraise by commit ID
 */
export function useSellAppraiseByCommit() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: { cycleId: string }) =>
      client.post<{
        totalEstimatedIsk: string;
        items: Array<{
          typeId: number;
          typeName: string;
          quantity: number;
          bestSellPrice: number;
          totalValue: string;
          stationId: number;
          stationName: string;
        }>;
      }>("/pricing/sell-appraise-by-commit", data),
  });
}

/**
 * Undercut check - Check if current listings need repricing
 */
export function useUndercutCheck() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data?: {
      characterIds?: number[];
      stationIds?: number[];
      cycleId?: string;
    }) =>
      client.post<{
        needsUpdate: Array<{
          lineId: string;
          typeId: number;
          typeName: string;
          currentPrice: number;
          lowestCompetitor: number;
          suggestedPrice: number;
          stationId: number;
        }>;
      }>("/pricing/undercut-check", data ?? {}),
  });
}

/**
 * Confirm listing - Confirm items have been listed
 */
export function useConfirmListing() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      lineId: string;
      listedUnits: number;
      listPricePerUnit: string;
    }) => client.post<void>("/pricing/confirm-listing", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

/**
 * Confirm reprice - Confirm items have been repriced
 */
export function useConfirmReprice() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { lineId: string; newPrice: string }) =>
      client.post<void>("/pricing/confirm-reprice", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}
