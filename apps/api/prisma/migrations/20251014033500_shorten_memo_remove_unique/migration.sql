-- AlterTable: Remove unique constraint from memo field
-- The new memo format is shorter (ARB-{first8chars}) to fit EVE's ~40 char limit
-- Multiple users can now have the same memo for the same cycle

-- Drop the unique constraint on memo
DROP INDEX IF EXISTS "cycle_participations_memo_key";

-- Add composite unique constraint on cycleId + userId
-- This ensures one participation per user per cycle
CREATE UNIQUE INDEX "cycle_user_unique" ON "cycle_participations"("cycle_id", "user_id");

