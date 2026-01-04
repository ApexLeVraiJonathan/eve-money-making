-- Add optional admin override for Tradecraft max participation per user
ALTER TABLE "public"."app_users"
ADD COLUMN "tradecraft_max_participation_isk" DECIMAL(28, 2);


