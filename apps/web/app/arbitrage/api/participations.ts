"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";;
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type { CycleParticipation } from "@eve/shared";

/**
 * API hooks for cycle participations (investor investments)
 */


// ============================================================================
// Queries
// ============================================================================

/**
 * Get all participations (admin only)
 */
export function useAllParticipations() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.participations.all(),
    queryFn: () =>
      client.get<CycleParticipation[]>("/ledger/participations/all"),
  });
}

/**
 * List participations for a specific cycle
 */
export function useParticipations(cycleId: string, status?: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.participations.list(cycleId, status),
    queryFn: () => {
      const params = status ? `?status=${status}` : "";
      return client.get<CycleParticipation[]>(
        `/ledger/cycles/${cycleId}/participations${params}`,
      );
    },
    enabled: !!cycleId,
  });
}

/**
 * Get current user's participation for a cycle
 */
export function useMyParticipation(cycleId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.participations.me(cycleId),
    queryFn: () =>
      client.get<CycleParticipation | null>(
        `/ledger/cycles/${cycleId}/participations/me`,
      ),
    enabled: !!cycleId,
  });
}

/**
 * Get unmatched donation journal entries
 */
export function useUnmatchedDonations() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.participations.unmatchedDonations(),
    queryFn: () =>
      client.get<
        Array<{
          journalId: string;
          characterId: number;
          characterName: string;
          amount: string;
          description: string | null;
          reason: string | null;
          date: string;
        }>
      >("/ledger/participations/unmatched-donations"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a participation (opt-in to a cycle)
 */
export function useCreateParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cycleId,
      data,
    }: {
      cycleId: string;
      data: {
        characterName?: string;
        amountIsk: string;
      };
    }) =>
      client.post<CycleParticipation>(
        `/ledger/cycles/${cycleId}/participations`,
        data,
      ),
    onSuccess: (_, { cycleId }) => {
      queryClient.invalidateQueries({
        queryKey: qk.participations.list(cycleId),
      });
      queryClient.invalidateQueries({
        queryKey: qk.participations.me(cycleId),
      });
    },
  });
}

/**
 * Opt out of a participation
 */
export function useOptOutParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (participationId: string) =>
      client.post<CycleParticipation>(
        `/ledger/participations/${participationId}/opt-out`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Validate a participation payment (admin only)
 */
export function useValidateParticipationPayment() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      participationId,
      walletJournalId,
    }: {
      participationId: string;
      walletJournalId?: string;
    }) =>
      client.post<CycleParticipation>(
        `/ledger/participations/${participationId}/validate`,
        { walletJournalId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Match participation payments from wallet (admin only)
 */
export function useMatchParticipationPayments() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cycleId?: string) => {
      const params = cycleId ? `?cycleId=${cycleId}` : "";
      return client.post<{
        matched: number;
        partial: number;
        unmatched: unknown[];
      }>(`/ledger/participations/match${params}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Mark payout as sent (admin only)
 */
export function useMarkPayoutSent() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (participationId: string) =>
      client.post<CycleParticipation>(
        `/ledger/participations/${participationId}/mark-payout-sent`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Mark participation as refunded (admin only)
 */
export function useRefundParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      participationId,
      amountIsk,
    }: {
      participationId: string;
      amountIsk: string;
    }) =>
      client.post<CycleParticipation>(
        `/ledger/participations/${participationId}/refund`,
        { amountIsk },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}
