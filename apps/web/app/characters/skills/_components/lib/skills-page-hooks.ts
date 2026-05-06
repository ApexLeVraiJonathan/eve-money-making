"use client";

import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import { useMyCharacters } from "@/app/tradecraft/api/characters/users.hooks";
import { qk } from "@eve/api-client/queryKeys";
import type {
  CharacterAttributesResponse,
  CharacterSkillsResponse,
  CharacterTrainingQueueSummary,
} from "@eve/shared/skill-contracts";

export type SkillCharacter = {
  id: number;
  name: string;
  isPrimary: boolean;
};

export function useMySkillCharacters(): SkillCharacter[] {
  const { data: chars = [] } = useMyCharacters();
  return (chars ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    isPrimary: c.isPrimary,
  }));
}

export function useCharacterTrainingQueue(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterTrainingQueue(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterTrainingQueueSummary | null;
      try {
        return await client.get<CharacterTrainingQueueSummary | null>(
          `/character-management/me/characters/${characterId}/training-queue`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

export function useCharacterSkillsSnapshot(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterSkills(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterSkillsResponse | null;
      try {
        return await client.get<CharacterSkillsResponse | null>(
          `/character-management/me/characters/${characterId}/skills`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}

export function useCharacterAttributes(characterId: number | null | undefined) {
  const client = useApiClient();
  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterAttributes(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterAttributesResponse | null;
      try {
        return await client.get<CharacterAttributesResponse | null>(
          `/character-management/me/characters/${characterId}/attributes`,
        );
      } catch {
        return null;
      }
    },
    retry: false,
  });
}
