"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  AdminCharacterRow,
  AdminUserCharacterLinkInput,
  AdminUserListItem,
  PrimaryUserSearchRow,
  SetUserRoleInput,
  SystemCharacterLinkUrlResponse,
  TradecraftUserAdminRow,
  UpdateCharacterProfileInput,
  UpdateTradecraftUserCapsInput,
  UpdateTradecraftUserCapsResponse,
} from "@eve/shared/tradecraft-characters";
export type {
  AdminCharacterRow,
  AdminUserListItem,
  PrimaryUserSearchRow,
  TradecraftUserAdminRow,
} from "@eve/shared/tradecraft-characters";

/**
 * API hooks for character and user administration
 *
 * Backend: apps/api/src/characters/auth.controller.ts (admin endpoints)
 *          apps/api/src/characters/users.controller.ts (admin endpoints)
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all users with their characters (admin only)
 */
export function useAllUsers() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.users.list(),
    queryFn: () => client.get<AdminUserListItem[]>("/admin/users"),
  });
}

/**
 * List users that have used Tradecraft (admin only).
 */
export function useTradecraftUsers(pagination?: {
  limit?: number;
  offset?: number;
}) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.users.tradecraft(pagination),
    queryFn: () => {
      const params = new URLSearchParams();
      if (pagination?.limit != null)
        params.set("limit", String(pagination.limit));
      if (pagination?.offset != null)
        params.set("offset", String(pagination.offset));
      const q = params.toString() ? `?${params.toString()}` : "";
      return client.get<TradecraftUserAdminRow[]>(
        `/admin/users/tradecraft${q}`,
      );
    },
  });
}

/**
 * Search users by primary (main) character name or character id (admin only).
 */
export function useSearchUsersByPrimaryCharacter(query?: string, limit = 20) {
  const client = useApiClient();
  const q = (query ?? "").trim();
  return useAuthenticatedQuery({
    queryKey:
      q.length >= 2
        ? qk.users.searchPrimary(q)
        : (["users", "searchPrimary", "empty"] as const),
    queryFn: async () => {
      if (q.length < 2) return [];
      const params = new URLSearchParams({
        q,
        limit: String(limit),
      });
      return await client.get<PrimaryUserSearchRow[]>(
        `/admin/users/search-primary?${params.toString()}`,
      );
    },
    enabled: q.length >= 2,
  });
}

/**
 * Update a user's Tradecraft caps (admin only).
 * - principalCapIsk: user-funded principal limit
 * - maximumCapIsk: total invested limit (principal + reinvested interest)
 * Pass null to clear and use defaults.
 */
export function useUpdateTradecraftUserMaxParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      principalCapIsk,
      maximumCapIsk,
    }: UpdateTradecraftUserCapsInput) =>
      client.patch<UpdateTradecraftUserCapsResponse>(
        `/admin/users/${userId}/tradecraft-caps`,
        {
        principalCapIsk,
        maximumCapIsk,
        },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.users.tradecraft() });
      queryClient.invalidateQueries({ queryKey: qk.users.byId(vars.userId) });
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
    },
  });
}

/**
 * Get all characters with admin details (admin only)
 */
export function useAdminCharacters() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["admin", "characters"],
    queryFn: () => client.get<AdminCharacterRow[]>("/auth/admin/characters"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Refresh character access token (admin only)
 */
export function useRefreshCharacterToken() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      client.get<void>(`/auth/refresh?characterId=${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "characters"] });
      queryClient.invalidateQueries({ queryKey: qk.characters.list() });
    },
  });
}

/**
 * Delete/unlink a character (admin only)
 */
export function useAdminDeleteCharacter() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      client.delete<void>(`/auth/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "characters"] });
      queryClient.invalidateQueries({ queryKey: qk.characters.list() });
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
    },
  });
}

/**
 * Update character profile (admin only)
 */
export function useUpdateCharacterProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      characterId,
      ...data
    }: UpdateCharacterProfileInput) =>
      client.patch<void>(`/auth/characters/${characterId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "characters"] });
      queryClient.invalidateQueries({ queryKey: qk.characters.list() });
    },
  });
}

/**
 * Set user role (admin only)
 */
export function useSetUserRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: SetUserRoleInput) =>
      client.patch<void>(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
    },
  });
}

/**
 * Force link a character to a user (admin only)
 */
export function useLinkCharacterToUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: AdminUserCharacterLinkInput) =>
      client.post<void>(`/admin/users/${userId}/link-character`, {
        characterId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
      queryClient.invalidateQueries({ queryKey: ["admin", "characters"] });
    },
  });
}

/**
 * Set user's primary character (admin only)
 */
export function useAdminSetPrimaryCharacter() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: AdminUserCharacterLinkInput) =>
      client.patch<void>(`/admin/users/${userId}/primary-character`, {
        characterId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
    },
  });
}

/**
 * Unlink a character from a user (admin only)
 */
export function useAdminUnlinkCharacter() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      characterId,
    }: AdminUserCharacterLinkInput) =>
      client.delete<void>(`/admin/users/${userId}/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
      queryClient.invalidateQueries({ queryKey: ["admin", "characters"] });
    },
  });
}

/**
 * Get system character link URL (admin only)
 */
export function useGetSystemCharacterLinkUrl() {
  const client = useApiClient();

  return useMutation({
    mutationFn: ({
      notes,
      returnUrl,
    }: {
      notes?: string;
      returnUrl?: string;
    } = {}) => {
      const params = new URLSearchParams();
      if (notes) params.set("notes", notes);
      if (returnUrl) params.set("returnUrl", returnUrl);
      const query = params.toString() ? `?${params.toString()}` : "";
      return client.get<SystemCharacterLinkUrlResponse>(
        `/auth/admin/system-characters/link/url${query}`,
      );
    },
  });
}
