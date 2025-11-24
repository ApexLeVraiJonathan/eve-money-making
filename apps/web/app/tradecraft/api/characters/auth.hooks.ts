"use client";

import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type { EveCharacter } from "@eve/shared";

/**
 * API hooks for authentication
 *
 * Backend: apps/api/src/characters/auth.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

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
