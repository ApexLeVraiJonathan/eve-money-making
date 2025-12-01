"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";
import type {
  CharacterSkillsResponse,
  CharacterTrainingQueueSummary,
} from "@eve/api-contracts";

export type CharacterOverview = {
  id: number;
  name: string;
  ownerHash: string;
  role: string;
  function: string | null;
  location: string | null;
  managedBy: string;
  isPrimary: boolean;
  tokenStatus: "missing" | "valid" | "expired";
  tokenExpiresAt: string | null;
  walletBalanceIsk: number | null;
  securityStatus: number | null;
  corporationId: number | null;
  allianceId: number | null;
  corporationName: string | null;
  allianceName: string | null;
  skillPoints?: number;
};

export type CharacterOverviewResponse = {
  characters: CharacterOverview[];
};

export type AccountCharacterSummary = {
  id: number;
  name: string;
  role: string;
  function: string | null;
  location: string | null;
  managedBy: string;
  tokenStatus: "missing" | "valid" | "expired";
  tokenExpiresAt: string | null;
};

export type AccountPlexSummary = {
  subscriptionId: string;
  type: "PLEX";
  startsAt: string | null;
  expiresAt: string;
  renewalCycleDays: number | null;
  expectedCostIsk: string | null;
  isActive: boolean;
  status: "none" | "active" | "expired" | "upcoming";
  daysRemaining: number | null;
};

export type EveAccountSummary = {
  id: string;
  label: string | null;
  notes: string | null;
  plex: AccountPlexSummary | null;
  characters: AccountCharacterSummary[];
};

export type AccountsResponse = {
  accounts: EveAccountSummary[];
  unassignedCharacters: AccountCharacterSummary[];
};

export type EveAccountPlex = {
  id: string;
  type: "PLEX";
  startsAt: string | null;
  expiresAt: string;
  renewalCycleDays: number | null;
  expectedCostIsk: string | null;
  isActive: boolean;
  notes: string | null;
};

export type CharacterBooster = {
  id: string;
  boosterName: string;
  source: string | null;
  startsAt: string;
  expiresAt: string;
  notes: string | null;
  status: "active" | "expired" | "upcoming";
};

export type EveAccountMct = {
  id: string;
  expiresAt: string;
  notes: string | null;
};

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
    mutationFn: (params: {
      accountId: string;
      label?: string;
      notes?: string;
    }) =>
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
    mutationFn: (input: { label?: string; notes?: string }) =>
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
    mutationFn: (params: { accountId: string; characterId: number }) =>
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
    mutationFn: (params: { accountId: string; characterId: number }) =>
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
    mutationFn: (input: {
      startsAt?: string;
      expiresAt: string;
      renewalCycleDays?: number;
      expectedCostIsk?: string;
      notes?: string;
    }) =>
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
    mutationFn: (params: {
      subscriptionId: string;
      startsAt?: string | null;
      expiresAt?: string | null;
      renewalCycleDays?: number | null;
      expectedCostIsk?: string | null;
      isActive?: boolean | null;
      notes?: string | null;
    }) =>
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
      client.delete(
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
    mutationFn: (input: { expiresAt: string; notes?: string }) =>
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
    mutationFn: (params: {
      slotId: string;
      expiresAt?: string;
      notes?: string | null;
    }) =>
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
      client.delete(
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
    mutationFn: (input: {
      boosterName: string;
      startsAt?: string;
      expiresAt: string;
      source?: string;
      notes?: string;
    }) =>
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
    mutationFn: (params: {
      boosterId: string;
      boosterName?: string | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      source?: string | null;
      notes?: string | null;
    }) =>
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
      client.delete(
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
      client.delete(`/character-management/me/accounts/${accountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.characterManagement.accounts(),
      });
    },
  });
}
