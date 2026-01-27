-- NPC market self-gather tables (regional orders filtered to station)

CREATE TABLE IF NOT EXISTS "public"."npc_market_station_baselines" (
  "station_id" INTEGER NOT NULL,
  "region_id" INTEGER NOT NULL,
  "baseline_id" TEXT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "npc_market_station_baselines_pkey" PRIMARY KEY ("station_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "npc_market_station_baselines_baseline_id_key"
  ON "public"."npc_market_station_baselines" ("baseline_id");

CREATE INDEX IF NOT EXISTS "npc_market_station_baselines_region_id_idx"
  ON "public"."npc_market_station_baselines" ("region_id");

CREATE TABLE IF NOT EXISTS "public"."npc_market_region_types_snapshots" (
  "region_id" INTEGER NOT NULL,
  "baseline_id" TEXT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "type_ids" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "npc_market_region_types_snapshots_pkey" PRIMARY KEY ("region_id", "baseline_id")
);

CREATE INDEX IF NOT EXISTS "npc_market_region_types_snapshots_observed_at_idx"
  ON "public"."npc_market_region_types_snapshots" ("observed_at");

CREATE TABLE IF NOT EXISTS "public"."npc_market_snapshots" (
  "station_id" INTEGER NOT NULL,
  "region_id" INTEGER NOT NULL,
  "type_id" INTEGER NOT NULL,
  "is_buy_order" BOOLEAN NOT NULL,
  "baseline_id" TEXT NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "orders" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "npc_market_snapshots_pkey" PRIMARY KEY ("station_id", "type_id", "is_buy_order", "baseline_id")
);

CREATE INDEX IF NOT EXISTS "npc_market_snapshots_station_baseline_idx"
  ON "public"."npc_market_snapshots" ("station_id", "baseline_id");

CREATE INDEX IF NOT EXISTS "npc_market_snapshots_region_id_idx"
  ON "public"."npc_market_snapshots" ("region_id");

CREATE INDEX IF NOT EXISTS "npc_market_snapshots_type_id_idx"
  ON "public"."npc_market_snapshots" ("type_id");

CREATE TABLE IF NOT EXISTS "public"."npc_market_order_trades_daily" (
  "scan_date" DATE NOT NULL,
  "station_id" INTEGER NOT NULL,
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
  CONSTRAINT "npc_market_order_trades_daily_pkey" PRIMARY KEY ("scan_date", "station_id", "type_id", "is_buy_order", "has_gone")
);

CREATE INDEX IF NOT EXISTS "npc_market_order_trades_daily_scan_date_idx"
  ON "public"."npc_market_order_trades_daily" ("scan_date");

CREATE INDEX IF NOT EXISTS "npc_market_order_trades_daily_station_id_idx"
  ON "public"."npc_market_order_trades_daily" ("station_id");

CREATE INDEX IF NOT EXISTS "npc_market_order_trades_daily_type_id_idx"
  ON "public"."npc_market_order_trades_daily" ("type_id");

CREATE TABLE IF NOT EXISTS "public"."npc_market_runs" (
  "baseline_id" TEXT NOT NULL,
  "station_id" INTEGER NOT NULL,
  "region_id" INTEGER NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "ok" BOOLEAN NOT NULL DEFAULT FALSE,
  "type_count" INTEGER,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "npc_market_runs_pkey" PRIMARY KEY ("baseline_id")
);

CREATE INDEX IF NOT EXISTS "npc_market_runs_station_started_at_idx"
  ON "public"."npc_market_runs" ("station_id", "started_at");

CREATE INDEX IF NOT EXISTS "npc_market_runs_region_started_at_idx"
  ON "public"."npc_market_runs" ("region_id", "started_at");

