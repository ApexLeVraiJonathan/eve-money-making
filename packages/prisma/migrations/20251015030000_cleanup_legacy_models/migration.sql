-- Drop legacy tables
DROP TABLE IF EXISTS "plan_commit_lines" CASCADE;
DROP TABLE IF EXISTS "plan_commits" CASCADE;

-- Clean up cycle_ledger table (remove execution tracking fields)
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "character_id";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "station_id";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "type_id";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "source";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "source_id";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "match_status";
ALTER TABLE "cycle_ledger" DROP COLUMN IF EXISTS "plan_commit_id";

-- Drop old indexes that no longer exist
DROP INDEX IF EXISTS "cycle_ledger_plan_commit_id_idx";
DROP INDEX IF EXISTS "cycle_ledger_character_id_idx";
DROP INDEX IF EXISTS "cycle_ledger_station_id_idx";
DROP INDEX IF EXISTS "cycle_ledger_type_id_idx";
DROP INDEX IF EXISTS "cycle_ledger_source_source_id_key";

-- Add new index for entryType
CREATE INDEX "cycle_ledger_entry_type_idx" ON "cycle_ledger"("entry_type");

