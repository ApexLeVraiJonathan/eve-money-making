"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";

/**
 * API hooks for wallet operations
 *
 * Backend: apps/api/src/wallet/wallet.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get wallet transactions (last 14 days)
 */
export function useWalletTransactions(characterId?: number) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.wallet.transactions(characterId),
    queryFn: () => {
      const params = characterId ? `?characterId=${characterId}` : "";
      return client.get<
        Array<{
          characterId: number;
          characterName: string | null;
          transactionId: string;
          date: string;
          isBuy: boolean;
          locationId: string;
          stationName: string | null;
          typeId: number;
          typeName: string | null;
          quantity: number;
          unitPrice: string;
        }>
      >(`/wallet-import/transactions${params}`);
    },
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Import wallet transactions for all linked characters
 */
export function useImportWallet() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<{
        imported: number;
        skipped: number;
        charactersProcessed: number;
      }>("/wallet-import/all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wallet._root });
    },
  });
}

/**
 * Reconcile and allocate wallet transactions to cycle lines
 */
export function useReconcileWallet() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId?: string) => {
      const params = cycleId ? `?cycleId=${cycleId}` : "";
      return client.post<{
        buysAllocated: number;
        sellsAllocated: number;
        unmatchedBuys: number;
        unmatchedSells: number;
      }>(`/recon/reconcile${params}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wallet._root });
      queryClient.invalidateQueries({ queryKey: qk.cycleLines._root });
    },
  });
}
