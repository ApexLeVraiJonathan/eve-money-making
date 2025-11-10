"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type { CommittedPackage } from "@eve/shared";

/**
 * API hooks for package management
 *
 * Backend: apps/api/src/market/packages.controller.ts
 */

// ============================================================================
// Queries
// ============================================================================

/**
 * List committed packages with optional filters
 */
export function usePackages(filters?: { cycleId?: string; status?: string }) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.packages.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.cycleId) params.set("cycleId", filters.cycleId);
      if (filters?.status) params.set("status", filters.status);
      const query = params.toString() ? `?${params.toString()}` : "";
      return client.get<CommittedPackage[]>(`/packages${query}`);
    },
  });
}

/**
 * Get package by ID
 */
export function usePackage(packageId: string) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.packages.byId(packageId),
    queryFn: () => client.get<CommittedPackage>(`/packages/${packageId}`),
    enabled: !!packageId,
  });
}

/**
 * Get active packages
 */
export function useActivePackages() {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: qk.packages.active(),
    queryFn: () => client.get<CommittedPackage[]>("/packages?status=ACTIVE"),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Plan packages from arbitrage opportunities
 */
export function usePlanPackages() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      opportunities: Array<{ typeId: number; quantity: number }>;
      destinationStationId: number;
    }) =>
      client.post<{
        packageId: string;
        items: Array<{
          typeId: number;
          quantity: number;
          buyPrice: string;
        }>;
      }>("/plan-packages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.packages._root });
    },
  });
}

/**
 * Mark package as failed
 */
export function useMarkPackageFailed() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      packageId,
      reason,
    }: {
      packageId: string;
      reason?: string;
    }) => client.post<void>(`/packages/${packageId}/mark-failed`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.packages._root });
    },
  });
}

