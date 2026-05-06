"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  GameDataImportAllResult,
  GameDataImportCountResult,
  GameDataImportResult,
  GameDataImportSummaryResponse,
} from "@eve/shared/tradecraft-data-ops";

/**
 * API hooks for game data import operations
 *
 * Backend: apps/api/src/game-data/import.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * Get import summary
 */
export function useImportSummary() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["gameData", "importSummary"],
    queryFn: () => client.get<GameDataImportSummaryResponse>("/import/summary"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Import market types (items)
 */
export function useImportTypes() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchSize?: number) => {
      const params = batchSize ? `?batchSize=${batchSize}` : "";
      return client.post<GameDataImportResult>(
        `/import/types${params}`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import stations
 */
export function useImportStations() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<GameDataImportResult>(
        "/import/stations",
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import systems
 */
export function useImportSystems() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<GameDataImportResult>(
        "/import/systems",
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import regions
 */
export function useImportRegions() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<GameDataImportResult>(
        "/import/regions",
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import all game data in sequence
 */
export function useImportAll() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.post<GameDataImportAllResult>("/import/all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import missing game data for a specific day
 */
export function useImportDay() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (day: string) =>
      client.post<GameDataImportCountResult>("/import/day", { day }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}

/**
 * Import missing types based on wallet transactions
 */
export function useImportMissing() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => client.post<GameDataImportCountResult>("/import/missing", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gameData", "importSummary"],
      });
    },
  });
}
