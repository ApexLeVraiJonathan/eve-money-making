-- Self-gathered structure market tables (kept separate from Adam4EVE imports)

CREATE TABLE IF NOT EXISTS "public"."self_market_snapshot_latest" (
  "location_id" BIGINT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "orders" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "self_market_snapshot_latest_pkey" PRIMARY KEY ("location_id")
);

CREATE INDEX IF NOT EXISTS "self_market_snapshot_latest_observed_at_idx"
  ON "public"."self_market_snapshot_latest" ("observed_at");

CREATE TABLE IF NOT EXISTS "public"."self_market_order_trades_daily" (
  "scan_date" DATE NOT NULL,
  "location_id" BIGINT NOT NULL,
  "type_id" INTEGER NOT NULL,
  "is_buy_order" BOOLEAN NOT NULL,
  "has_gone" BOOLEAN NOT NULL,
  "amount" BIGINT NOT NULL,
  "high" DECIMAL(28, 2) NOT NULL,
  "low" DECIMAL(28, 2) NOT NULL,
  "avg" DECIMAL(28, 2) NOT NULL,
  "order_num" BIGINT NOT NULL,
  "isk_value" DECIMAL(28, 2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "self_market_order_trades_daily_pkey" PRIMARY KEY ("scan_date", "location_id", "type_id", "is_buy_order", "has_gone")
);

CREATE INDEX IF NOT EXISTS "self_market_order_trades_daily_scan_date_idx"
  ON "public"."self_market_order_trades_daily" ("scan_date");

CREATE INDEX IF NOT EXISTS "self_market_order_trades_daily_location_id_idx"
  ON "public"."self_market_order_trades_daily" ("location_id");

CREATE INDEX IF NOT EXISTS "self_market_order_trades_daily_type_id_idx"
  ON "public"."self_market_order_trades_daily" ("type_id");

