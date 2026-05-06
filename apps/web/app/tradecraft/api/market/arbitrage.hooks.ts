"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type {
  PlanResult,
  ArbitrageCheckRequest,
  ArbitrageCheckResponse,
} from "@eve/shared/tradecraft-arbitrage";
import type { Cycle } from "@eve/shared/tradecraft-cycles";
import type {
  ArbitrageCommitResponse,
  CommitSummaryItem,
} from "@eve/shared/tradecraft-arbitrage";

/**
 * API hooks for arbitrage opportunities and commitments
 *
 * Backend: apps/api/src/market/arbitrage.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * List arbitrage commits (cycles with commit data)
 */
export function useArbitrageCommits(
  options?: {
    limit?: number;
    offset?: number;
  },
  queryOptions?: {
    enabled?: boolean;
  },
) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["arbitrage", "commits", options],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.offset) params.set("offset", String(options.offset));
      const query = params.toString() ? `?${params.toString()}` : "";
      return client.get<Cycle[]>(`/arbitrage/commits${query}`);
    },
    enabled: queryOptions?.enabled,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Check arbitrage opportunities
 */
export function useArbitrageCheck() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (data: ArbitrageCheckRequest) =>
      client.post<ArbitrageCheckResponse>("/arbitrage/check", data),
  });
}

/**
 * Plan arbitrage packages
 */
export function usePlanArbitrage() {
  const client = useApiClient();

  return useMutation({
    mutationFn: (data: unknown) =>
      client.post<PlanResult>("/arbitrage/plan-packages", data),
  });
}

/**
 * Commit to arbitrage plan
 */
export function useCommitArbitrage() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { request: unknown; result: unknown; memo?: string }) =>
      client.post<ArbitrageCommitResponse>("/arbitrage/commit", data),
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
      client.get<CommitSummaryItem[]>(`/ledger/commits/summary?cycleId=${cycleId}`),
  });
}
