export type CharacterRole = "USER" | "LOGISTICS";
export type CharacterManagedBy = "USER" | "SYSTEM";
export type CharacterFunction = "SELLER" | "BUYER";
export type CharacterLocation =
  | "JITA"
  | "DODIXIE"
  | "AMARR"
  | "HEK"
  | "RENS"
  | "CN";
export type CycleStatus = "PLANNED" | "OPEN" | "COMPLETED";
export type NotificationChannel = "DISCORD_DM";
export type NotificationType =
  | "CYCLE_PLANNED"
  | "CYCLE_STARTED"
  | "CYCLE_RESULTS"
  | "CYCLE_PAYOUT_SENT"
  | "PLEX_ENDING"
  | "MCT_ENDING"
  | "BOOSTER_ENDING"
  | "TRAINING_QUEUE_IDLE";
export type ParticipationStatus =
  | "AWAITING_INVESTMENT"
  | "AWAITING_VALIDATION"
  | "OPTED_IN"
  | "OPTED_OUT"
  | "AWAITING_PAYOUT"
  | "COMPLETED"
  | "REFUNDED";
export type RolloverType = "FULL_PAYOUT" | "INITIAL_ONLY" | "CUSTOM_AMOUNT";
