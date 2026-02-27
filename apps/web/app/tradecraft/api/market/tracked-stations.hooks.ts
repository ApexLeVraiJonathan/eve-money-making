"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type { TrackedStation } from "@eve/shared/tradecraft-market";
export type { TrackedStation } from "@eve/shared/tradecraft-market";

/**
 * API hooks for tracked station management
 *
 * Backend: apps/api/src/market/tracked-stations.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all tracked stations
 */
export function useTrackedStations() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["market", "trackedStations"],
    queryFn: () => client.get<TrackedStation[]>("/tracked-stations"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Add tracked station
 */
export function useAddTrackedStation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stationId: number) =>
      client.post<TrackedStation>("/tracked-stations", { stationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["market", "trackedStations"],
      });
    },
  });
}

/**
 * Remove tracked station
 */
export function useRemoveTrackedStation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => client.delete<void>(`/tracked-stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["market", "trackedStations"],
      });
    },
  });
}
