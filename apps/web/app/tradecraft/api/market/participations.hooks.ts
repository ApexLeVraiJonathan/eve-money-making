"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type { CycleParticipation } from "@eve/shared";
import { ApiError } from "@eve/api-client";

/**
 * API hooks for cycle participations (investor investments)
 *
 * These hooks are related to the cycles domain but live in the API structure
 * Backend: apps/api/src/cycles/cycles.controller.ts (participations endpoints)
 */

export type AutoRolloverSettings = {
  enabled: boolean;
  defaultRolloverType: "FULL_PAYOUT" | "INITIAL_ONLY";
};

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
 * Get my participation history across all cycles
 */
export function useMyParticipationHistory() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["myParticipationHistory"],
    queryFn: () =>
      client.get<
        Array<
          CycleParticipation & {
            cycle: {
              id: string;
              name: string | null;
              startedAt: string;
              closedAt: string | null;
              status: string;
            };
          }
        >
      >("/ledger/participations/my-history"),
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
 * Get maximum allowed participation amount for current user
 */
export function useMaxParticipation() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["maxParticipation"],
    queryFn: () =>
      client.get<{
        principalCapIsk: string;
        principalCapB: number;
        effectivePrincipalCapIsk: string;
        effectivePrincipalCapB: number;
        maximumCapIsk: string;
        maximumCapB: number;
      }>("/ledger/participations/max-amount"),
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

/**
 * Get my automatic rollover settings (tradecraft cycles).
 *
 * If the user is logged out, the backend returns defaults (enabled=false).
 */
export function useAutoRolloverSettings(enabled = true) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.participations.autoRolloverSettings(),
    queryFn: async () => {
      try {
        return await client.get<AutoRolloverSettings>(
          "/ledger/participations/auto-rollover-settings",
        );
      } catch (e) {
        // If the backend is protected in some environments, degrade gracefully.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return { enabled: false, defaultRolloverType: "INITIAL_ONLY" };
        }
        throw e;
      }
    },
    enabled,
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

  return useMutation({
    mutationFn: ({
      cycleId,
      data,
    }: {
      cycleId: string;
      data: {
        characterName?: string;
        amountIsk: string;
        rollover?: {
          type: "FULL_PAYOUT" | "INITIAL_ONLY" | "CUSTOM_AMOUNT";
          customAmountIsk?: string;
        };
      };
    }) =>
      client.post<CycleParticipation>(
        `/ledger/cycles/${cycleId}/participations`,
        data,
      ),
    // Don't invalidate queries immediately - let the caller handle it
    // This prevents the parent component from re-rendering and closing dialogs
    onSuccess: () => {
      // Queries will be invalidated when the dialog closes
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
      walletJournal,
    }: {
      participationId: string;
      walletJournal?: { characterId: number; journalId: string };
    }) =>
      client.post<CycleParticipation>(
        `/ledger/participations/${participationId}/validate`,
        { walletJournal },
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

/**
 * Increase principal for an existing participation (planned cycles only)
 */
export function useIncreaseParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      participationId,
      deltaAmountIsk,
    }: {
      participationId: string;
      deltaAmountIsk: string;
    }) =>
      client.post<{
        participation: CycleParticipation;
        previousAmountIsk: string;
        deltaAmountIsk: string;
        newAmountIsk: string;
      }>(`/ledger/participations/${participationId}/increase`, {
        deltaAmountIsk,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}

/**
 * Update my automatic rollover settings.
 */
export function useUpdateAutoRolloverSettings() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AutoRolloverSettings) =>
      client.patch<AutoRolloverSettings>(
        "/ledger/participations/auto-rollover-settings",
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.participations.autoRolloverSettings(),
      });
    },
  });
}
