export const TRADECRAFT_TYPES = [
  "CYCLE_PLANNED",
  "CYCLE_STARTED",
  "CYCLE_RESULTS",
  "CYCLE_PAYOUT_SENT",
] as const;

export const CHARACTERS_TYPES = [
  "SKILL_PLAN_REMAP_REMINDER",
  "SKILL_PLAN_COMPLETION",
  "PLEX_ENDING",
  "MCT_ENDING",
  "BOOSTER_ENDING",
  "TRAINING_QUEUE_IDLE",
] as const;

export type NotificationTypeKey =
  | (typeof TRADECRAFT_TYPES)[number]
  | (typeof CHARACTERS_TYPES)[number];

export type PrefItem = {
  type: NotificationTypeKey;
  title: string;
  description: string;
};

export const TRADECRAFT_ITEMS: PrefItem[] = [
  {
    type: "CYCLE_PLANNED",
    title: "Cycle planned",
    description: "New investment cycle opens for opt-in",
  },
  {
    type: "CYCLE_STARTED",
    title: "Cycle started",
    description: "Trading begins on your opted-in cycle",
  },
  {
    type: "CYCLE_RESULTS",
    title: "Cycle results ready",
    description: "Performance summary is finalized",
  },
  {
    type: "CYCLE_PAYOUT_SENT",
    title: "Payout sent",
    description: "Your cycle payout has been processed",
  },
];

export const CHARACTERS_ITEMS: PrefItem[] = [
  {
    type: "SKILL_PLAN_REMAP_REMINDER",
    title: "Skill plan remap reminders",
    description:
      "Discord DMs before planned attribute remaps for assigned skill plans",
  },
  {
    type: "SKILL_PLAN_COMPLETION",
    title: "Skill plan completion",
    description: "Discord DMs shortly before assigned skill plans complete",
  },
  {
    type: "PLEX_ENDING",
    title: "PLEX ending",
    description:
      "Reminders when tracked PLEX or account subscription time is close to expiring",
  },
  {
    type: "MCT_ENDING",
    title: "MCT ending",
    description: "Reminders when tracked MCT training slots are close to expiring",
  },
  {
    type: "BOOSTER_ENDING",
    title: "Booster ending",
    description: "Reminders when an active character booster is close to expiring",
  },
  {
    type: "TRAINING_QUEUE_IDLE",
    title: "Training queue idle",
    description:
      "Alerts when a character has available training time but no skills queued",
  },
];
