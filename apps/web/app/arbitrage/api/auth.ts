"use client";

import { useQuery } from "@tanstack/react-query";
import { clientForApp } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import type { User, EveCharacter } from "@eve/shared";

/**
 * API hooks for authentication and user management
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
    queryFn: () => client.get<User>("/auth/me"),
    retry: false, // Don't retry on 401
  });
}

/**
 * Get current user's linked characters
 */
export function useMyCharacters() {
  return useQuery({
    queryKey: qk.characters.linked(),
    queryFn: () => client.get<EveCharacter[]>("/users/me/characters"),
  });
}

/**
 * Get all characters (admin only)
 */
export function useAllCharacters() {
  return useQuery({
    queryKey: qk.characters.list(),
    queryFn: () => client.get<EveCharacter[]>("/auth/characters"),
  });
}
