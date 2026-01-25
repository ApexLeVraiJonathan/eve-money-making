-- Add a persisted toggle for whether to include training boosters in skill-farm math.

ALTER TABLE "skill_farm_settings"
ADD COLUMN "use_boosters" BOOLEAN NOT NULL DEFAULT TRUE;

