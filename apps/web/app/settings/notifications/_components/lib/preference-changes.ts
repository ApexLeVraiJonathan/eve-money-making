import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";

export function getChangedPrefs(
  localPrefs: NotificationPreferenceDto[],
  preferences: NotificationPreferenceDto[],
) {
  return localPrefs.filter((local) => {
    const original = preferences.find(
      (p) =>
        p.channel === local.channel && p.notificationType === local.notificationType,
    );
    return original?.enabled !== local.enabled;
  });
}

export function buildSaveMessage(changedPrefs: NotificationPreferenceDto[]) {
  const enabledCount = changedPrefs.filter((p) => p.enabled).length;
  const disabledCount = changedPrefs.filter((p) => !p.enabled).length;

  if (enabledCount > 0 && disabledCount > 0) {
    return `${enabledCount} enabled, ${disabledCount} disabled`;
  }
  if (enabledCount > 0) {
    return `${enabledCount} notification${enabledCount > 1 ? "s" : ""} enabled`;
  }
  if (disabledCount > 0) {
    return `${disabledCount} notification${disabledCount > 1 ? "s" : ""} disabled`;
  }

  return "Notification preferences updated";
}
