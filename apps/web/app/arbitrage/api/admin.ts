"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientForApp } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import type { User, EveCharacter } from "@eve/shared";

/**
 * API hooks for admin operations
 */

const client = clientForApp("api");

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all users (admin only)
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => client.get<User[]>("/admin/users"),
  });
}

/**
 * Get all characters (admin only)
 */
export function useAdminCharacters() {
  return useQuery({
    queryKey: qk.characters.list(),
    queryFn: () =>
      client.get<
        Array<
          EveCharacter & {
            hasToken: boolean;
            userId: string | null;
            userName?: string;
          }
        >
      >("/admin/characters"),
  });
}

/**
 * Get import summary
 */
export function useImportSummary() {
  return useQuery({
    queryKey: ["admin", "importSummary"],
    queryFn: () =>
      client.get<{
        types: number;
        stations: number;
        systems: number;
        regions: number;
        lastImport: string | null;
      }>("/admin/import-summary"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Set user role (admin only)
 */
export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      client.patch<User>(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users._root });
    },
  });
}

/**
 * Link character to user (admin only)
 */
export function useAdminLinkCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: {
      userId: string;
      characterId: number;
    }) =>
      client.post<void>(`/admin/users/${userId}/link-character`, {
        characterId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users._root });
      queryClient.invalidateQueries({ queryKey: qk.characters._root });
    },
  });
}

/**
 * Unlink character from user (admin only)
 */
export function useAdminUnlinkCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: {
      userId: string;
      characterId: number;
    }) =>
      client.delete<void>(`/admin/users/${userId}/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users._root });
      queryClient.invalidateQueries({ queryKey: qk.characters._root });
    },
  });
}

/**
 * Import game data (types, stations, etc.)
 */
export function useImportGameData() {
  return useMutation({
    mutationFn: (endpoint: string) =>
      client.post<{ imported: number; skipped: number }>(
        `/import/${endpoint}`,
        {},
      ),
  });
}

/**
 * Run background job
 */
export function useRunJob() {
  return useMutation({
    mutationFn: (jobName: string) =>
      client.post<{ success: boolean; result?: unknown }>(
        `/jobs/${jobName}`,
        {},
      ),
  });
}

/**
 * Get system token link URL
 */
export function useGetSystemTokenLinkUrl() {
  return useMutation({
    mutationFn: (characterId: number) =>
      client.post<{ url: string }>("/auth/admin/system-characters/link/url", {
        characterId,
      }),
  });
}

/**
 * Set primary character for user (admin only)
 */
export function useAdminSetPrimaryCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: {
      userId: string;
      characterId: number;
    }) =>
      client.patch<void>(`/admin/users/${userId}/primary-character`, {
        characterId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users._root });
    },
  });
}

// ============================================================================
// Jobs / Background Tasks
// ============================================================================

/**
 * Run ESI cache cleanup job
 */
export function useCleanupEsiCache() {
  return useMutation({
    mutationFn: () => client.get<{ removed: number }>("/jobs/esi-cache/cleanup"),
  });
}

/**
 * Run staleness/backfill job
 */
export function useBackfillTrades() {
  return useMutation({
    mutationFn: () => client.get<{ backfilled: number }>("/jobs/staleness"),
  });
}

/**
 * Run wallet imports and allocation
 */
export function useRunWalletJob() {
  return useMutation({
    mutationFn: () =>
      client.get<{ ok: boolean; buysAllocated: number; sellsAllocated: number }>(
        "/jobs/wallets/run",
      ),
  });
}

/**
 * Cleanup expired OAuth states
 */
export function useCleanupOAuthStates() {
  return useMutation({
    mutationFn: () => client.get<{ removed: number }>("/jobs/oauth-state/cleanup"),
  });
}

/**
 * Refresh system character tokens
 */
export function useRefreshSystemTokens() {
  return useMutation({
    mutationFn: () => client.get<{ ok: boolean }>("/jobs/system-tokens/refresh"),
  });
}

/**
 * Cleanup old wallet journals
 */
export function useCleanupWalletJournals() {
  return useMutation({
    mutationFn: () => client.post<{ removed: number }>("/jobs/wallet/cleanup", {}),
  });
}

// ============================================================================
// Tracked Stations
// ============================================================================

/**
 * List all tracked stations
 */
export function useTrackedStations() {
  return useQuery({
    queryKey: ["trackedStations", "list"],
    queryFn: () =>
      client.get<
        Array<{
          id: string;
          stationId: number;
          stationName: string;
          createdAt: string;
        }>
      >("/tracked-stations"),
  });
}

/**
 * Get tracked station by ID
 */
export function useTrackedStation(id: string | null) {
  return useQuery({
    queryKey: ["trackedStations", id],
    queryFn: () =>
      client.get<{
        id: string;
        stationId: number;
        stationName: string;
        createdAt: string;
      }>(`/tracked-stations/${id}`),
    enabled: !!id,
  });
}

/**
 * Add tracked station
 */
export function useAddTrackedStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stationId: number) =>
      client.post<{ id: string }>("/tracked-stations", { stationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackedStations"] });
    },
  });
}

/**
 * Remove tracked station
 */
export function useRemoveTrackedStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => client.delete<void>(`/tracked-stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackedStations"] });
    },
  });
}

// ============================================================================
// Wallet Import
// ============================================================================

/**
 * Import wallet for specific character
 */
export function useImportCharacterWallet() {
  return useMutation({
    mutationFn: (characterId: number) =>
      client.get<{ imported: number }>(
        `/wallet-import/character?characterId=${characterId}`,
      ),
  });
}

/**
 * Import wallet for all linked characters
 */
export function useImportAllWallets() {
  return useMutation({
    mutationFn: () =>
      client.post<{ imported: number }>("/wallet-import/all", {}),
  });
}

/**
 * List wallet transactions
 */
export function useWalletTransactions(params: {
  characterId?: number;
  sinceDays?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["wallet", "transactions", params],
    queryFn: () => {
      const query = new URLSearchParams();
      if (params.characterId) query.set("characterId", String(params.characterId));
      if (params.sinceDays) query.set("sinceDays", String(params.sinceDays));
      if (params.limit) query.set("limit", String(params.limit));
      if (params.offset) query.set("offset", String(params.offset));

      return client.get<
        Array<{
          id: string;
          date: string;
          quantity: number;
          unitPrice: number;
          typeId: number;
          locationId: number;
          isBuy: boolean;
        }>
      >(`/wallet-import/transactions?${query.toString()}`);
    },
    enabled: !!params.characterId,
  });
}

/**
 * List wallet journal entries
 */
export function useWalletJournal(params: {
  characterId?: number;
  sinceDays?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["wallet", "journal", params],
    queryFn: () => {
      const query = new URLSearchParams();
      if (params.characterId) query.set("characterId", String(params.characterId));
      if (params.sinceDays) query.set("sinceDays", String(params.sinceDays));
      if (params.limit) query.set("limit", String(params.limit));
      if (params.offset) query.set("offset", String(params.offset));

      return client.get<
        Array<{
          id: string;
          date: string;
          amount: number;
          balance: number;
          refType: string;
          description: string;
        }>
      >(`/wallet-import/journal?${query.toString()}`);
    },
    enabled: !!params.characterId,
  });
}
