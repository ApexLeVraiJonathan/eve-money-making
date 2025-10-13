-- Clean up legacy ADMIN values from eve_characters.role prior to enum change
-- Safe to run multiple times; guarded by enum label existence check

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'CharacterRole' AND e.enumlabel = 'ADMIN'
  ) THEN
    UPDATE "eve_characters"
    SET "role" = 'USER'
    WHERE "role" = 'ADMIN';
  END IF;
END $$;


