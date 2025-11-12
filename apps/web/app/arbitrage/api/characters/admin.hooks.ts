"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

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
    queryFn: () =>
      client.get<
        Array<{
          id: string;
          role: "USER" | "ADMIN";
          primaryCharacterId: number | null;
          characters: Array<{ id: number; name: string }>;
        }>
      >("/admin/users"),
  });
}

/**
 * Get all characters with admin details (admin only)
 */
export function useAdminCharacters() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["admin", "characters"],
    queryFn: () =>
      client.get<
        Array<{
          characterId: number;
          characterName: string;
          ownerHash: string;
          userId: string | null;
          accessTokenExpiresAt: string | null;
          scopes: string | null;
          role?: string;
          function?: string | null;
          location?: string | null;
          managedBy?: string;
          notes?: string | null;
        }>
      >("/auth/admin/characters"),
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
    }: {
      characterId: number;
      role?: string;
      function?: string;
      location?: string;
      notes?: string;
    }) => client.patch<void>(`/auth/characters/${characterId}`, data),
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
    }: {
      userId: string;
      role: "USER" | "ADMIN";
    }) => client.patch<void>(`/admin/users/${userId}/role`, { role }),
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
    }: {
      userId: string;
      characterId: number;
    }) =>
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
    }: {
      userId: string;
      characterId: number;
    }) =>
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
    }: {
      userId: string;
      characterId: number;
    }) =>
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
      return client.get<{ url: string }>(
        `/auth/admin/system-characters/link/url${query}`,
      );
    },
  });
}
