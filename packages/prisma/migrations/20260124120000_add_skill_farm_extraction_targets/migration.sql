-- Add per-user extraction target skills (EVE type IDs)
ALTER TABLE "skill_farm_settings"
ADD COLUMN IF NOT EXISTS "extraction_target_skill_ids" INTEGER[] NOT NULL DEFAULT '{}';

