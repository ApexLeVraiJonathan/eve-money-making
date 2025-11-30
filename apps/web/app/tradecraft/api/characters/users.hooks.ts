"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

/**
 * API hooks for user and character management
 *
 * Backend: apps/api/src/characters/users.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get current authenticated user
 * Returns null when not authenticated (401/403)
 */
export function useCurrentUser() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.users.me(),
    queryFn: async () => {
      try {
        return await client.get<{
          userId: string | null;
          role: string;
          characterId: number;
          characterName: string;
        }>("/auth/me");
      } catch (e) {
        // Gracefully handle unauthenticated state - return null (not undefined)
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return null;
        }
        throw e;
      }
    },
    retry: false, // Don't retry on 401
  });
}

/**
 * Get current user's linked characters
 * Returns empty array when not authenticated
 */
export function useMyCharacters() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.characters.linked(),
    queryFn: async () => {
      try {
        return await client.get<
          Array<{ id: number; name: string; isPrimary: boolean }>
        >("/users/me/characters");
      } catch (e) {
        // Return empty list when unauthenticated
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return [];
        }
        throw e;
      }
    },
    retry: false,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Set primary character
 */
export function useSetPrimaryCharacter() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      client.patch<void>("/users/me/primary-character", { characterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.me() });
      queryClient.invalidateQueries({ queryKey: qk.characters.linked() });
    },
  });
}

/**
 * Unlink a character
 */
export function useUnlinkCharacter() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      client.delete<void>(`/users/me/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.me() });
      queryClient.invalidateQueries({ queryKey: qk.characters.linked() });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.overview(),
      });
    },
  });
}

/**
 * Start character linking flow (redirects to EVE SSO)
 */
export function startCharacterLink(returnUrl?: string) {
  const url = returnUrl
    ? `/api/auth/link-character/start?returnUrl=${encodeURIComponent(
        returnUrl,
      )}`
    : `/api/auth/link-character/start`;
  window.location.href = url;
}

/**
 * Logout user
 */
export async function logout() {
  // Backend clears the HTTP-only session cookie and responds with JSON.
  // This route proxies to the API /auth/logout endpoint.
  window.location.href = "/api/auth/signout";
}

/**
 * Start user login via backend SSO (USER role)
 */
export function startUserLogin(returnUrl?: string) {
  const url = returnUrl
    ? `/api/auth/login/user?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/api/auth/login/user`;
  window.location.href = url;
}

/**
 * Start admin login via backend SSO (LOGISTICS role)
 */
export function startAdminLogin(returnUrl?: string) {
  const url = returnUrl
    ? `/api/auth/login/admin?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/api/auth/login/admin`;
  window.location.href = url;
}
