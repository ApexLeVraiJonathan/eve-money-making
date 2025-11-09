"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientForApp } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";

/**
 * API hooks for wallet operations
 */

const client = clientForApp("api");

// ============================================================================
// Queries
// ============================================================================

/**
 * Get wallet transactions (last 14 days)
 */
export function useWalletTransactions(characterId?: number) {
  return useQuery({
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
          locationId: number;
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<{
        imported: number;
        skipped: number;
        charactersProcessed: number;
      }>("/wallet/import-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wallet._root });
    },
  });
}

/**
 * Reconcile and allocate wallet transactions to cycle lines
 */
export function useReconcileWallet() {
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
