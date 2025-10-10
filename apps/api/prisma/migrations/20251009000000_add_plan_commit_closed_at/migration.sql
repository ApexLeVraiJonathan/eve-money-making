-- Add closed_at to plan_commits
ALTER TABLE "plan_commits" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP NULL;

