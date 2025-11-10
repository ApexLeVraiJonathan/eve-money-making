"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";;
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";

/**
 * API hooks for arbitrage opportunities and commitments
 */


// ============================================================================
// Mutations
// ============================================================================

/**
 * Commit to arbitrage plan
 */
export function useCommitArbitrage() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      planCommitId: string;
      cycleId: string;
      items: Array<{
        typeId: number;
        quantity: number;
        buyStationId: number;
        sellStationId: number;
      }>;
    }) =>
      client.post<{
        committed: number;
        packageId?: string;
      }>("/arbitrage/commit", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.arbitrage._root });
      queryClient.invalidateQueries({ queryKey: qk.packages._root });
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

/**
 * Get commit summaries (moved to cycles)
 */
export function useCommitSummaries(cycleId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: () =>
      client.get<
        Array<{
          id: string;
          typeId: number;
          typeName: string;
          quantity: number;
        }>
      >(`/ledger/commits/summary?cycleId=${cycleId}`),
  });
}
