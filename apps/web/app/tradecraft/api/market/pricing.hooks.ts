"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { qk } from "@eve/api-client/queryKeys";
import type {
  SellAppraiseResponse,
  SellAppraiseByCommitResponse,
  UndercutCheckResponse,
} from "@eve/shared/types";

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
      client.post<SellAppraiseResponse>("/pricing/sell-appraise", data),
  });
}

/**
 * Sell appraise by commit ID
 * Returns array of items directly (not wrapped in object)
 */
export function useSellAppraiseByCommit() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: { cycleId: string }) =>
      client.post<SellAppraiseByCommitResponse>(
        "/pricing/sell-appraise-by-commit",
        data,
      ),
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
      groupingMode?: "perOrder" | "perCharacter" | "global";
      minUndercutVolumeRatio?: number;
      minUndercutUnits?: number;
      expiryRefreshDays?: number;
    }) =>
      client.post<UndercutCheckResponse>("/pricing/undercut-check", data ?? {}),
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
