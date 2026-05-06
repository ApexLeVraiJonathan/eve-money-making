"use client";

import * as React from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { toast } from "@eve/ui";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";

type UpdatePrefsMutation = {
  isPending: boolean;
  mutateAsync: (prefs: NotificationPreferenceDto[]) => Promise<unknown>;
};

type Params = {
  searchParams: ReadonlyURLSearchParams | null;
  router: { replace: (href: string) => void };
  discordConnected: boolean;
  loadingPrefs: boolean;
  preferences: NotificationPreferenceDto[];
  updatePrefs: UpdatePrefsMutation;
  refetchPrefs: () => Promise<unknown>;
};

export function useAutoEnableCyclePlanned({
  searchParams,
  router,
  discordConnected,
  loadingPrefs,
  preferences,
  updatePrefs,
  refetchPrefs,
}: Params) {
  const [autoEnableDone, setAutoEnableDone] = React.useState(false);

  React.useEffect(() => {
    const from = searchParams?.get("from");
    const autoEnable = searchParams?.get("autoEnable");
    const shouldAutoEnable = from === "tradecraft" && autoEnable === "cycle_planned";

    if (!shouldAutoEnable) return;
    if (autoEnableDone) return;
    if (!discordConnected) return;
    if (loadingPrefs) return;
    if (updatePrefs.isPending) return;

    const hasCyclePlannedEnabled = preferences.some(
      (p) =>
        p.channel === "DISCORD_DM" &&
        p.notificationType === "CYCLE_PLANNED" &&
        p.enabled,
    );
    if (hasCyclePlannedEnabled) {
      setAutoEnableDone(true);
      router.replace("/settings/notifications");
      return;
    }

    setAutoEnableDone(true);

    const next = (() => {
      const exists = preferences.some(
        (p) => p.channel === "DISCORD_DM" && p.notificationType === "CYCLE_PLANNED",
      );
      if (!exists) {
        return [
          ...preferences,
          {
            channel: "DISCORD_DM",
            notificationType: "CYCLE_PLANNED",
            enabled: true,
          } satisfies NotificationPreferenceDto,
        ];
      }
      return preferences.map((p) =>
        p.channel === "DISCORD_DM" && p.notificationType === "CYCLE_PLANNED"
          ? { ...p, enabled: true }
          : p,
      );
    })();

    void (async () => {
      try {
        await updatePrefs.mutateAsync(next);
        await refetchPrefs();
        toast.success("Enabled Discord DM: Cycle planned");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        router.replace("/settings/notifications");
      }
    })();
  }, [
    autoEnableDone,
    discordConnected,
    loadingPrefs,
    preferences,
    refetchPrefs,
    router,
    searchParams,
    updatePrefs,
  ]);
}
