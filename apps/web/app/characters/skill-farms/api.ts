"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { qk } from "@eve/api-client/queryKeys";
import type {
  SkillFarmSettings,
  SkillFarmCharacterStatus,
  SkillFarmTrackingSnapshot,
  SkillFarmMathInputs,
  SkillFarmMathResult,
  SkillFarmMarketPricesSnapshot,
} from "@eve/api-contracts";

export function useSkillFarmSettings() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.skillFarm.settings(),
    queryFn: async () => {
      return await client.get<SkillFarmSettings>("/skill-farm/settings");
    },
    retry: false,
  });
}

export function useUpdateSkillFarmSettings() {
  const client = useApiClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<SkillFarmSettings>) => {
      return await client.put<SkillFarmSettings>("/skill-farm/settings", input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillFarm.settings() });
    },
  });
}

export function useSkillFarmCharacters() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.skillFarm.characters(),
    queryFn: async () => {
      return await client.get<SkillFarmCharacterStatus[]>(
        "/skill-farm/characters",
      );
    },
    retry: false,
  });
}

export function useUpdateSkillFarmCharacter() {
  const client = useApiClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      characterId: number;
      payload: {
        isCandidate?: boolean;
        isActiveFarm?: boolean;
        farmPlanId?: string | null;
        includeInNotifications?: boolean;
      };
    }) => {
      return await client.patch<SkillFarmCharacterStatus[]>(
        `/skill-farm/characters/${params.characterId}`,
        params.payload,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.skillFarm.characters() });
      qc.invalidateQueries({ queryKey: qk.skillFarm.tracking() });
    },
  });
}

export function useSkillFarmTracking() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.skillFarm.tracking(),
    queryFn: async () => {
      return await client.get<SkillFarmTrackingSnapshot>(
        "/skill-farm/tracking",
      );
    },
    retry: false,
    // Tracking data can be moderately cached; allow some staleness.
    staleTime: 60_000,
  });
}

export function useSkillFarmMathPreview() {
  const client = useApiClient();

  return useMutation({
    mutationFn: async (input: SkillFarmMathInputs) => {
      return await client.post<SkillFarmMathResult>(
        "/skill-farm/math/preview",
        input,
      );
    },
  });
}

export function useSkillFarmMarketPrices() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.skillFarm.marketPrices(),
    queryFn: async () => {
      return await client.get<SkillFarmMarketPricesSnapshot>(
        "/skill-farm/market-prices",
      );
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}
