"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  Cycle,
  CycleOverview,
  CycleLine,
  CycleSnapshot,
  CycleProfit,
  CapitalResponse,
  CycleLedgerEntry,
  PayoutSuggestion,
  CycleFeeEvent,
} from "@eve/shared";

/**
 * API hooks for cycle management
 * 
 * Backend: apps/api/src/cycles/cycles.controller.ts
 * 
 * Uses useApiClient() for authenticated API calls with Bearer tokens
 * and centralized query keys from @eve/api-client/queryKeys
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get cycle overview (current + next cycle with stats)
 */
export function useCycleOverview() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.overview(),
    queryFn: () => client.get<CycleOverview>("/ledger/cycles/overview"),
  });
}

/**
 * List all cycles
 */
export function useCycles() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.list(),
    queryFn: () => client.get<Cycle[]>("/ledger/cycles"),
  });
}

/**
 * Get specific cycle by ID
 */
export function useCycle(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.byId(cycleId),
    queryFn: () => client.get<Cycle>(`/ledger/cycles/${cycleId}`),
    enabled: !!cycleId,
  });
}

/**
 * Get cycle snapshots
 */
export function useCycleSnapshots(cycleId: string, limit?: number) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.snapshots(cycleId),
    queryFn: () => {
      const params = limit ? `?limit=${limit}` : "";
      return client.get<CycleSnapshot[]>(
        `/ledger/cycles/${cycleId}/snapshots${params}`,
      );
    },
    enabled: !!cycleId,
  });
}

/**
 * Get cycle profit breakdown
 */
export function useCycleProfit(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.profit(cycleId),
    queryFn: () => client.get<CycleProfit>(`/ledger/cycles/${cycleId}/profit`),
    enabled: !!cycleId,
  });
}

/**
 * Get detailed profit breakdown (P&L statement)
 */
export function useProfitBreakdown(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: [...qk.cycles.profit(cycleId), "breakdown"],
    queryFn: () =>
      client.get<{
        revenue: {
          grossSales: string;
          salesTax: string;
          netSales: string;
        };
        cogs: {
          totalCogs: string;
          unitsSold: number;
          avgCostPerUnit: string;
        };
        grossProfit: string;
        expenses: {
          transportFees: string;
          brokerFees: string;
          relistFees: string;
          totalExpenses: string;
        };
        netProfit: string;
        roi: {
          percentage: string;
          initialCapital: string;
        };
      }>(`/ledger/cycles/${cycleId}/profit/breakdown`),
    enabled: !!cycleId,
  });
}

/**
 * Get estimated profit for cycle
 */
export function useCycleEstimatedProfit(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.estimatedProfit(cycleId),
    queryFn: () =>
      client.get<{ estimatedTotalProfit: string; breakdown: unknown[] }>(
        `/ledger/cycles/${cycleId}/profit/estimated`,
      ),
    enabled: !!cycleId,
  });
}

/**
 * Get portfolio value for cycle
 */
export function useCyclePortfolioValue(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.portfolioValue(cycleId),
    queryFn: () =>
      client.get<{ totalValue: string; items: unknown[] }>(
        `/ledger/cycles/${cycleId}/profit/portfolio`,
      ),
    enabled: !!cycleId,
  });
}

/**
 * Get cycle capital breakdown
 */
export function useCycleCapital(cycleId: string, force?: boolean) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.capital(cycleId, force),
    queryFn: () => {
      const params = force ? "?force=true" : "";
      return client.get<CapitalResponse>(`/ledger/capital/${cycleId}${params}`);
    },
    enabled: !!cycleId,
  });
}

/**
 * Get cycle NAV (Net Asset Value)
 */
export function useCycleNav(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.nav(cycleId),
    queryFn: () =>
      client.get<{
        deposits: string;
        withdrawals: string;
        fees: string;
        executions: string;
        net: string;
      }>(`/ledger/nav/${cycleId}`),
    enabled: !!cycleId,
  });
}

/**
 * List ledger entries for a cycle
 */
export function useCycleEntries(
  cycleId: string,
  options?: { limit?: number; offset?: number },
) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycles.entries(cycleId, options),
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.offset) params.set("offset", String(options.offset));
      const query = params.toString() ? `?${params.toString()}` : "";
      return client.get<CycleLedgerEntry[]>(
        `/ledger/entries${query}&cycleId=${cycleId}`,
      );
    },
    enabled: !!cycleId,
  });
}

/**
 * List cycle lines (item tracking)
 */
export function useCycleLines(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.cycleLines.list(cycleId),
    queryFn: () => client.get<CycleLine[]>(`/ledger/cycles/${cycleId}/lines`),
    enabled: !!cycleId,
  });
}

/**
 * Get transport fees for a cycle
 */
export function useTransportFees(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.fees.transport(cycleId),
    queryFn: () =>
      client.get<CycleFeeEvent[]>(`/ledger/cycles/${cycleId}/transport-fees`),
    enabled: !!cycleId,
  });
}

/**
 * Suggest payouts for a cycle
 */
export function useSuggestPayouts(cycleId: string, profitSharePct?: number) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.payouts.suggest(cycleId, profitSharePct),
    queryFn: () => {
      const params = profitSharePct ? `?profitSharePct=${profitSharePct}` : "";
      return client.get<PayoutSuggestion>(
        `/ledger/cycles/${cycleId}/payouts/suggest${params}`,
      );
    },
    enabled: !!cycleId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create and start a new cycle immediately
 */
export function useCreateCycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name?: string;
      startedAt: string;
      initialInjectionIsk?: string;
    }) => client.post<Cycle>("/ledger/cycles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycles._root });
    },
  });
}

/**
 * Plan a new cycle for future start
 */
export function usePlanCycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name?: string;
      startedAt: string;
      initialInjectionIsk?: string;
    }) => client.post<Cycle>("/ledger/cycles/plan", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycles._root });
    },
  });
}

/**
 * Open a planned cycle
 */
export function useOpenCycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      startedAt,
    }: {
      cycleId: string;
      startedAt?: string;
    }) => client.post<Cycle>(`/ledger/cycles/${cycleId}/open`, { startedAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycles._root });
    },
  });
}

/**
 * Close a cycle
 */
export function useCloseCycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId: string) =>
      client.post<Cycle>(`/ledger/cycles/${cycleId}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycles._root });
    },
  });
}

/**
 * Create a cycle snapshot
 */
export function useCreateCycleSnapshot() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId: string) =>
      client.post<CycleSnapshot>(`/ledger/cycles/${cycleId}/snapshot`, {}),
    onSuccess: (_, cycleId) => {
      queryClient.invalidateQueries({ queryKey: qk.cycles.snapshots(cycleId) });
    },
  });
}

/**
 * Create a cycle line
 */
export function useCreateCycleLine() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      data,
    }: {
      cycleId: string;
      data: {
        typeId: number;
        destinationStationId: number;
        plannedUnits: number;
      };
    }) => client.post<CycleLine>(`/ledger/cycles/${cycleId}/lines`, data),
    onSuccess: (_, { cycleId }) => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines.list(cycleId) });
    },
  });
}

/**
 * Update a cycle line
 */
export function useUpdateCycleLine() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lineId,
      data,
    }: {
      lineId: string;
      data: { plannedUnits?: number };
    }) => client.patch<CycleLine>(`/ledger/lines/${lineId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

/**
 * Delete a cycle line
 */
export function useDeleteCycleLine() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineId: string) =>
      client.delete<void>(`/ledger/lines/${lineId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

/**
 * Add transport fee to cycle
 */
export function useAddTransportFee() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      data,
    }: {
      cycleId: string;
      data: { amountIsk: string; memo?: string };
    }) =>
      client.post<CycleFeeEvent>(
        `/ledger/cycles/${cycleId}/transport-fee`,
        data,
      ),
    onSuccess: (_, { cycleId }) => {
      queryClient.invalidateQueries({ queryKey: qk.fees.transport(cycleId) });
    },
  });
}

/**
 * Finalize payouts for a cycle
 */
export function useFinalizePayouts() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      profitSharePct,
    }: {
      cycleId: string;
      profitSharePct?: number;
    }) =>
      client.post<{ created: number }>(
        `/ledger/cycles/${cycleId}/payouts/finalize`,
        { profitSharePct: profitSharePct ?? 0.5 },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.payouts._root });
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Add broker fee to cycle line
 */
export function useAddBrokerFee() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lineId,
      amountIsk,
    }: {
      lineId: string;
      amountIsk: string;
    }) =>
      client.post<void>(`/ledger/lines/${lineId}/broker-fee`, { amountIsk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

/**
 * Add relist fee to cycle line
 */
export function useAddRelistFee() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lineId,
      amountIsk,
    }: {
      lineId: string;
      amountIsk: string;
    }) =>
      client.post<void>(`/ledger/lines/${lineId}/relist-fee`, { amountIsk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}

