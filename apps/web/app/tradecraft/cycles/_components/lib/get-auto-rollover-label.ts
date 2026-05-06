import type { AutoRolloverSettings } from "@eve/shared/tradecraft-participations";

export function getAutoRolloverLabel(
  settings: AutoRolloverSettings | null | undefined,
) {
  if (!settings?.enabled) {
    return "Off";
  }

  return settings.defaultRolloverType === "FULL_PAYOUT"
    ? "Full payout"
    : "Initial only";
}
