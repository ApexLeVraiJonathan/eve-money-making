-- Track user-funded principal for each participation (used for principal cap enforcement)
ALTER TABLE "public"."cycle_participations"
ADD COLUMN IF NOT EXISTS "user_principal_isk" DECIMAL(28, 2);


