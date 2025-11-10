"use client";

;
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type { User, EveCharacter } from "@eve/shared";

/**
 * API hooks for authentication and user management
 */


// ============================================================================
// Queries
// ============================================================================

/**
 * Get current authenticated user
 */
export function useCurrentUser() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.users.me(),
    queryFn: () => client.get<User>("/auth/me"),
    retry: false, // Don't retry on 401
  });
}

/**
 * Get current user's linked characters
 */
export function useMyCharacters() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.characters.linked(),
    queryFn: () => client.get<EveCharacter[]>("/users/me/characters"),
  });
}

/**
 * Get all characters (admin only)
 */
export function useAllCharacters() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.characters.list(),
    queryFn: () => client.get<EveCharacter[]>("/auth/characters"),
  });
}
