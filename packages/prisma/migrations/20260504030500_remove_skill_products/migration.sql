-- Batch 8 intentionally removes retired skill-farm and user-owned skill-plan products.
-- This migration is destructive by design: persisted farm settings, farm character
-- configs, plans, plan steps, and plan assignments are dropped.

DELETE FROM "notification_preferences"
WHERE "notification_type" IN (
  'SKILL_PLAN_REMAP_REMINDER',
  'SKILL_PLAN_COMPLETION',
  'SKILL_FARM_EXTRACTOR_READY',
  'SKILL_FARM_QUEUE_LOW'
);

DROP TABLE IF EXISTS "skill_farm_character_configs";
DROP TABLE IF EXISTS "skill_plan_assignments";
DROP TABLE IF EXISTS "skill_plan_steps";
DROP TABLE IF EXISTS "skill_farm_settings";
DROP TABLE IF EXISTS "skill_plans";

CREATE TYPE "NotificationType_new" AS ENUM (
  'CYCLE_PLANNED',
  'CYCLE_STARTED',
  'CYCLE_RESULTS',
  'CYCLE_PAYOUT_SENT',
  'PLEX_ENDING',
  'MCT_ENDING',
  'BOOSTER_ENDING',
  'TRAINING_QUEUE_IDLE'
);

ALTER TABLE "notification_preferences"
  ALTER COLUMN "notification_type" TYPE "NotificationType_new"
  USING ("notification_type"::text::"NotificationType_new");

DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
