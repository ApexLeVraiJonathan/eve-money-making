"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type { JingleYieldProgramSummary, JingleYieldStatus } from "@eve/shared";
import { qk } from "@eve/api-client/queryKeys";

// ============================================================================
// Queries
// ============================================================================

/**
 * List all JingleYield programs (admin only)
 */
export function useJingleYieldPrograms() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["jingleYield", "programs"],
    queryFn: () =>
      client.get<JingleYieldProgramSummary[]>("/ledger/jingle-yield/programs"),
  });
}

/**
 * Get a single JingleYield program (admin only)
 */
export function useJingleYieldProgram(id: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["jingleYield", "program", id],
    queryFn: () =>
      client.get<JingleYieldProgramSummary>(
        `/ledger/jingle-yield/programs/${id}`,
      ),
    enabled: !!id,
  });
}

/**
 * Get current user's JingleYield status (if any)
 */
export function useMyJingleYieldStatus() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["jingleYield", "me"],
    queryFn: () =>
      client.get<JingleYieldStatus | null>("/ledger/jingle-yield/me"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a JingleYield participation for a user (admin only)
 */
export function useCreateJingleYieldParticipation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      userId: string;
      cycleId: string;
      adminCharacterId: number;
      characterName: string;
      principalIsk?: string;
      minCycles?: number;
    }) => client.post("/ledger/jingle-yield/participations", data),
    onSuccess: () => {
      // Refresh related data after creation
      queryClient.invalidateQueries({ queryKey: ["jingleYield"] });
      queryClient.invalidateQueries({ queryKey: qk.participations._root });
    },
  });
}
