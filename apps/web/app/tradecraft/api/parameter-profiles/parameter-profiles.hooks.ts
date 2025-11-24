"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

/**
 * API hooks for parameter profiles
 *
 * Backend: apps/api/src/parameter-profiles/parameter-profiles.controller.ts
 */

export type ParameterProfileScope = "LIQUIDITY" | "ARBITRAGE" | "PLANNER";

export interface ParameterProfile {
  id: string;
  name: string;
  description?: string;
  scope: ParameterProfileScope;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateParameterProfileDto {
  name: string;
  description?: string;
  scope: ParameterProfileScope;
  params: Record<string, unknown>;
}

export interface UpdateParameterProfileDto {
  name?: string;
  description?: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List all parameter profiles, optionally filtered by scope
 */
export function useParameterProfiles(
  scope?: ParameterProfileScope,
  queryOptions?: {
    enabled?: boolean;
  },
) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["parameter-profiles", { scope }],
    queryFn: () => {
      const query = scope ? `?scope=${scope}` : "";
      return client.get<ParameterProfile[]>(`/parameter-profiles${query}`);
    },
    enabled: queryOptions?.enabled,
  });
}

/**
 * Get a specific parameter profile by ID
 */
export function useParameterProfile(
  id: string | null | undefined,
  queryOptions?: {
    enabled?: boolean;
  },
) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    queryKey: ["parameter-profiles", id],
    queryFn: () => client.get<ParameterProfile>(`/parameter-profiles/${id}`),
    enabled: queryOptions?.enabled !== false && !!id,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new parameter profile
 */
export function useCreateParameterProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateParameterProfileDto) =>
      client.post<ParameterProfile>("/parameter-profiles", data),
    onSuccess: (newProfile) => {
      // Invalidate the list query for this scope
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: newProfile.scope }],
      });
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: undefined }],
      });
    },
  });
}

/**
 * Update an existing parameter profile
 */
export function useUpdateParameterProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateParameterProfileDto;
    }) => client.patch<ParameterProfile>(`/parameter-profiles/${id}`, data),
    onSuccess: (updatedProfile) => {
      // Invalidate both the specific profile and the list
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", updatedProfile.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: updatedProfile.scope }],
      });
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: undefined }],
      });
    },
  });
}

/**
 * Delete a parameter profile
 */
export function useDeleteParameterProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; scope: ParameterProfileScope }) =>
      client.delete<void>(`/parameter-profiles/${id}`),
    onSuccess: (_, variables) => {
      // Invalidate the list queries
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: variables.scope }],
      });
      queryClient.invalidateQueries({
        queryKey: ["parameter-profiles", { scope: undefined }],
      });
      // Remove the specific profile from cache
      queryClient.removeQueries({
        queryKey: ["parameter-profiles", variables.id],
      });
    },
  });
}
