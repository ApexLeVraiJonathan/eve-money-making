-- Tradecraft per-user caps (principal cap + maximum cap)
ALTER TABLE "public"."app_users"
ADD COLUMN IF NOT EXISTS "tradecraft_principal_cap_isk" DECIMAL(28, 2),
ADD COLUMN IF NOT EXISTS "tradecraft_maximum_cap_isk" DECIMAL(28, 2);


