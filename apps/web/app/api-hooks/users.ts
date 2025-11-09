"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientForApp } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import type { User, EveCharacter } from "@eve/shared";

/**
 * API hooks for user and character management
 */

const client = clientForApp("api");

// ============================================================================
// Queries
// ============================================================================

/**
 * Get current authenticated user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: qk.users.me(),
    queryFn: () =>
      client.get<{
        userId: string | null;
        role: string;
        characterId: number;
        characterName: string;
      }>("/auth/me"),
    retry: false, // Don't retry on 401
  });
}

/**
 * Get current user's linked characters
 */
export function useMyCharacters() {
  return useQuery({
    queryKey: qk.characters.linked(),
    queryFn: () =>
      client.get<Array<{ id: number; name: string; isPrimary: boolean }>>(
        "/users/me/characters",
      ),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Set primary character
 */
export function useSetPrimaryCharacter() {
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: number) =>
      client.delete<void>(`/users/me/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.me() });
      queryClient.invalidateQueries({ queryKey: qk.characters.linked() });
    },
  });
}

/**
 * Start character linking flow (redirects to EVE SSO)
 */
export function startCharacterLink(returnUrl?: string) {
  const url = returnUrl
    ? `/api/auth/link-character/start?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/api/auth/link-character/start`;
  window.location.href = url;
}

/**
 * Logout user
 */
export async function logout() {
  await client.get("/auth/logout");
  window.location.href = "/";
}
