-- Add lightweight snapshot stats so the UI can show per-type summaries without
-- fetching full JSON order arrays for every type.

ALTER TABLE "public"."npc_market_snapshots"
  ADD COLUMN IF NOT EXISTS "order_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "best_price" DECIMAL(28, 2);

CREATE INDEX IF NOT EXISTS "npc_market_snapshots_station_baseline_type_side_idx"
  ON "public"."npc_market_snapshots" ("station_id", "baseline_id", "type_id", "is_buy_order");

