"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@eve/api-client";
import { qk } from "@eve/api-client/queryKeys";
import { useApiClient } from "@/app/api-hooks/useApiClient";
import { useAuthenticatedQuery } from "@/app/api-hooks/useAuthenticatedQuery";

export type DiscordAccountDto = {
  id: string;
  userId: string;
  discordUserId: string;
  username: string;
  discriminator: string | null;
  avatarUrl: string | null;
  linkedAt: string;
};

export type NotificationPreferenceDto = {
  channel: "DISCORD_DM";
  notificationType:
    | "CYCLE_PLANNED"
    | "CYCLE_STARTED"
    | "CYCLE_RESULTS"
    | "CYCLE_PAYOUT_SENT"
    | "SKILL_PLAN_REMAP_REMINDER"
    | "SKILL_PLAN_COMPLETION"
    | "PLEX_ENDING"
    | "MCT_ENDING"
    | "BOOSTER_ENDING"
    | "TRAINING_QUEUE_IDLE";
  enabled: boolean;
};

export function useDiscordAccount() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.notifications.discordAccount(),
    queryFn: async () => {
      try {
        return await client.get<DiscordAccountDto | null>(
          "/notifications/discord/account",
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

export function useNotificationPreferences() {
  const client = useApiClient();

  return useAuthenticatedQuery({
    queryKey: qk.notifications.preferences(),
    queryFn: async () => {
      try {
        return await client.get<NotificationPreferenceDto[]>(
          "/notifications/preferences",
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return [] as NotificationPreferenceDto[];
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useUpdateNotificationPreferences() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: NotificationPreferenceDto[]) =>
      client.patch<{ ok: boolean }>("/notifications/preferences", {
        preferences: prefs,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.notifications.preferences(),
      });
    },
  });
}

export function useDisconnectDiscord() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.delete<{ ok: boolean }>("/notifications/discord/account"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.notifications.discordAccount(),
      });
    },
  });
}

export function startDiscordConnect(returnUrl?: string) {
  const url = returnUrl
    ? `/api/notifications/discord/connect?returnUrl=${encodeURIComponent(
        returnUrl,
      )}`
    : `/api/notifications/discord/connect`;
  window.location.href = url;
}

export function useSendTestNotification() {
  const client = useApiClient();

  return useMutation({
    mutationFn: () =>
      client.post<{ ok: boolean; error?: string }>(
        "/notifications/debug/test-dm",
        {},
      ),
  });
}

export function useSendTradecraftCyclePlannedPreview() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (cycleId?: string) =>
      client.post<{ ok: boolean; error?: string }>(
        "/notifications/debug/tradecraft/cycle-planned",
        cycleId ? { cycleId } : {},
      ),
  });
}

export function useSendTradecraftCycleStartedPreview() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (cycleId?: string) =>
      client.post<{ ok: boolean; error?: string }>(
        "/notifications/debug/tradecraft/cycle-started",
        cycleId ? { cycleId } : {},
      ),
  });
}

export function useSendTradecraftCycleResultsPreview() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (cycleId?: string) =>
      client.post<{ ok: boolean; error?: string }>(
        "/notifications/debug/tradecraft/cycle-results",
        cycleId ? { cycleId } : {},
      ),
  });
}

export function useSendTradecraftPayoutSentPreview() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (participationId?: string) =>
      client.post<{ ok: boolean; error?: string }>(
        "/notifications/debug/tradecraft/payout-sent",
        participationId ? { participationId } : {},
      ),
  });
}
