"use client";

import * as React from "react";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";
import type { NotificationTypeKey } from "./notification-types";

export function useNotificationPreferencesState(
  preferences: NotificationPreferenceDto[],
) {
  const [localPrefs, setLocalPrefs] = React.useState<NotificationPreferenceDto[]>([]);

  React.useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleToggle = React.useCallback(
    (pref: NotificationPreferenceDto, enabled: boolean) => {
      setLocalPrefs((prev) =>
        prev.map((p) =>
          p.channel === pref.channel && p.notificationType === pref.notificationType
            ? { ...p, enabled }
            : p,
        ),
      );
    },
    [],
  );

  const getPref = React.useCallback(
    (type: NotificationTypeKey) =>
      localPrefs.find(
        (p) => p.channel === "DISCORD_DM" && p.notificationType === type,
      ),
    [localPrefs],
  );

  const getGroupState = React.useCallback(
    (types: readonly NotificationTypeKey[]) => {
      const enabledCount = types.reduce(
        (acc, t) => acc + (getPref(t)?.enabled ? 1 : 0),
        0,
      );
      if (enabledCount === 0) return false as const;
      if (enabledCount === types.length) return true as const;
      return "indeterminate" as const;
    },
    [getPref],
  );

  const groupStatus = React.useCallback((state: boolean | "indeterminate") => {
    if (state === true) {
      return {
        label: "All on",
        className: "text-green-600 dark:text-green-400",
      } as const;
    }
    if (state === "indeterminate") {
      return {
        label: "Some",
        className: "text-amber-600 dark:text-amber-400",
      } as const;
    }
    return { label: "All off", className: "text-muted-foreground" } as const;
  }, []);

  const toggleGroup = React.useCallback(
    (types: readonly NotificationTypeKey[], value: boolean | "indeterminate") => {
      const enabled = value === true;
      setLocalPrefs((prev) =>
        prev.map((p) =>
          p.channel === "DISCORD_DM" &&
          (types as readonly string[]).includes(p.notificationType)
            ? { ...p, enabled }
            : p,
        ),
      );
    },
    [],
  );

  const hasAnyEnabled = localPrefs.some(
    (p) => p.channel === "DISCORD_DM" && p.enabled,
  );
  const hasChanges = React.useMemo(
    () => JSON.stringify(localPrefs) !== JSON.stringify(preferences),
    [localPrefs, preferences],
  );

  return {
    localPrefs,
    hasAnyEnabled,
    hasChanges,
    handleToggle,
    getPref,
    getGroupState,
    groupStatus,
    toggleGroup,
  };
}
