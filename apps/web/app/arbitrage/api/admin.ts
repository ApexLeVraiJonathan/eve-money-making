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
