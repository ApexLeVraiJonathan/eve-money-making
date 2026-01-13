-- Fix drift: some dev DBs may have trade_strategy_runs without timestamps
ALTER TABLE "public"."trade_strategy_runs"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."trade_strategy_runs"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

