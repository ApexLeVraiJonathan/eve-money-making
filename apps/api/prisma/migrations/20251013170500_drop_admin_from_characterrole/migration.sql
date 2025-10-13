-- Remove ADMIN from CharacterRole enum safely

DO $$
BEGIN
  -- Ensure no ADMIN labels remain (migration 20251013170000 handles update)
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'CharacterRole' AND e.enumlabel = 'ADMIN'
  ) THEN
    -- Create a new enum without ADMIN
    CREATE TYPE "public"."CharacterRole_new" AS ENUM ('USER', 'LOGISTICS');
    -- Alter columns to new type
    -- Drop default to allow type change
    ALTER TABLE "public"."eve_characters"
      ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "public"."eve_characters"
      ALTER COLUMN "role" TYPE "public"."CharacterRole_new"
      USING ("role"::text::"public"."CharacterRole_new");
    -- Restore default
    ALTER TABLE "public"."eve_characters"
      ALTER COLUMN "role" SET DEFAULT 'USER';
    -- Drop old enum and rename
    DROP TYPE "public"."CharacterRole";
    ALTER TYPE "public"."CharacterRole_new" RENAME TO "CharacterRole";
  END IF;
END $$;


