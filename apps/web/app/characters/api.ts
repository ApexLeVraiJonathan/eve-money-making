"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  CharacterSkillsResponse,
  CharacterTrainingQueueSummary,
} from "@eve/shared/skill-contracts";
import type {
  AccountsResponse,
  AssignCharacterToAccountInput,
  CharacterManagementActionResult,
  CharacterBooster,
  CharacterOverviewResponse,
  CreateAccountInput,
  CreateBoosterInput,
  CreateMctInput,
  CreatePlexSubscriptionInput,
  EveAccountMct,
  EveAccountPlex,
  UnassignCharacterFromAccountInput,
  UpdateAccountMetadataInput,
  UpdateBoosterInput,
  UpdateMctInput,
  UpdatePlexSubscriptionInput,
} from "@eve/shared/character-management";
export type {
  AccountsResponse,
  AssignCharacterToAccountInput,
  CharacterManagementActionResult,
  CharacterBooster,
  CharacterOverview,
  CharacterOverviewResponse,
  CreateAccountInput,
  CreateBoosterInput,
  CreateMctInput,
  CreatePlexSubscriptionInput,
  EveAccountMct,
  EveAccountPlex,
  UnassignCharacterFromAccountInput,
  UpdateAccountMetadataInput,
  UpdateBoosterInput,
  UpdateMctInput,
  UpdatePlexSubscriptionInput,
} from "@eve/shared/character-management";

export function useCharacterOverview() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.characterManagement.overview(),
    queryFn: async () => {
      try {
        return await client.get<CharacterOverviewResponse>(
          "/character-management/me/overview",
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return { characters: [] };
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useMyAccounts() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.characterManagement.accounts(),
    queryFn: async () => {
      try {
        return await client.get<AccountsResponse>(
          "/character-management/me/accounts",
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return { accounts: [], unassignedCharacters: [] };
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useAccountPlex(accountId: string | null | undefined) {
  const client = useApiClient();

  return useAuthenticatedQuery({
    enabled: !!accountId,
    queryKey: qk.characterManagement.accountPlex(accountId ?? "none"),
    queryFn: async () => {
      if (!accountId) return [] as EveAccountPlex[];
      try {
        return await client.get<EveAccountPlex[]>(
          `/character-management/me/accounts/${accountId}/plex`,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return [];
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useAccountMct(accountId: string | null | undefined) {
  const client = useApiClient();

  return useAuthenticatedQuery({
    enabled: !!accountId,
    queryKey: ["characterManagement", "accountMct", accountId ?? "none"],
    queryFn: async () => {
      if (!accountId) return [] as EveAccountMct[];
      try {
        return await client.get<EveAccountMct[]>(
          `/character-management/me/accounts/${accountId}/mct`,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return [];
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useCharacterBoosters(characterId: number | null | undefined) {
  const client = useApiClient();

  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterBoosters(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return [] as CharacterBooster[];
      try {
        return await client.get<CharacterBooster[]>(
          `/character-management/me/characters/${characterId}/boosters`,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return [];
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useUpdateAccountMetadata() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateAccountMetadataInput) =>
      client.patch(`/character-management/me/accounts/${params.accountId}`, {
        label: params.label,
        notes: params.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}

export function useCreateAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      client.post("/character-management/me/accounts", input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}

export function useAssignCharacterToAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AssignCharacterToAccountInput) =>
      client.post(
        `/character-management/me/accounts/${params.accountId}/characters`,
        { characterId: params.characterId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}

export function useUnassignCharacterFromAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UnassignCharacterFromAccountInput) =>
      client.delete(
        `/character-management/me/accounts/${params.accountId}/characters/${params.characterId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}

export function useCreatePlexSubscription(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlexSubscriptionInput) =>
      client.post(`/character-management/me/accounts/${accountId}/plex`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accountPlex(accountId),
      });
    },
  });
}

export function useUpdatePlexSubscription(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdatePlexSubscriptionInput) =>
      client.patch(
        `/character-management/me/accounts/${accountId}/plex/${params.subscriptionId}`,
        {
          startsAt: params.startsAt,
          expiresAt: params.expiresAt,
          renewalCycleDays: params.renewalCycleDays,
          expectedCostIsk: params.expectedCostIsk,
          isActive: params.isActive,
          notes: params.notes,
        },
      ),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accountPlex(accountId),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accountPlex(params.subscriptionId),
      });
    },
  });
}

export function useDeletePlexSubscription(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      client.delete<CharacterManagementActionResult>(
        `/character-management/me/accounts/${accountId}/plex/${subscriptionId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accountPlex(accountId),
      });
    },
  });
}

export function useCreateMct(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMctInput) =>
      client.post(`/character-management/me/accounts/${accountId}/mct`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["characterManagement", "accountMct", accountId],
      });
    },
  });
}

export function useUpdateMct(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateMctInput) =>
      client.patch(
        `/character-management/me/accounts/${accountId}/mct/${params.slotId}`,
        {
          expiresAt: params.expiresAt,
          notes: params.notes,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["characterManagement", "accountMct", accountId],
      });
    },
  });
}

export function useDeleteMct(accountId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slotId: string) =>
      client.delete<CharacterManagementActionResult>(
        `/character-management/me/accounts/${accountId}/mct/${slotId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["characterManagement", "accountMct", accountId],
      });
    },
  });
}

export function useCreateBooster(characterId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBoosterInput) =>
      client.post(
        `/character-management/me/characters/${characterId}/boosters`,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.characterBoosters(characterId),
      });
    },
  });
}

export function useUpdateBooster(characterId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateBoosterInput) =>
      client.patch(
        `/character-management/me/characters/${characterId}/boosters/${params.boosterId}`,
        {
          boosterName: params.boosterName,
          startsAt: params.startsAt,
          expiresAt: params.expiresAt,
          source: params.source,
          notes: params.notes,
        },
      ),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.characterBoosters(characterId),
      });
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.characterBoosters(
          Number(params.boosterId),
        ),
      });
    },
  });
}

export function useDeleteBooster(characterId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boosterId: string) =>
      client.delete<CharacterManagementActionResult>(
        `/character-management/me/characters/${characterId}/boosters/${boosterId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.characterBoosters(characterId),
      });
    },
  });
}

export function useCharacterTrainingQueue(
  characterId: number | null | undefined,
) {
  const client = useApiClient();

  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterTrainingQueue(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterTrainingQueueSummary | null;
      try {
        return await client.get<CharacterTrainingQueueSummary>(
          `/character-management/me/characters/${characterId}/training-queue`,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useCharacterSkills(characterId: number | null | undefined) {
  const client = useApiClient();

  return useAuthenticatedQuery({
    enabled: !!characterId,
    queryKey: qk.characterManagement.characterSkills(characterId ?? 0),
    queryFn: async () => {
      if (!characterId) return null as CharacterSkillsResponse | null;
      try {
        return await client.get<CharacterSkillsResponse>(
          `/character-management/me/characters/${characterId}/skills`,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useDeleteAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      client.delete<CharacterManagementActionResult>(
        `/character-management/me/accounts/${accountId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}
