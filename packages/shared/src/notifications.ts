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

export type NotificationActionResponse = {
  ok: boolean;
  error?: string;
};
