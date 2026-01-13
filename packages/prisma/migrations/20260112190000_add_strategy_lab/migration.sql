-- Tradecraft Strategy Lab tables

-- CreateEnum
CREATE TYPE "public"."TradeStrategyRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TradeStrategySellModel" AS ENUM ('VOLUME_SHARE', 'CALIBRATED_CAPTURE');

-- CreateEnum
CREATE TYPE "public"."TradeStrategyPriceModel" AS ENUM ('LOW', 'AVG', 'HIGH');

-- CreateTable
CREATE TABLE "public"."trade_strategies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "params" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trade_strategy_runs" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "status" "public"."TradeStrategyRunStatus" NOT NULL DEFAULT 'QUEUED',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "initial_capital_isk" DECIMAL(28,2) NOT NULL,
    "sell_model" "public"."TradeStrategySellModel" NOT NULL,
    "sell_share_pct" DECIMAL(10,6),
    "price_model" "public"."TradeStrategyPriceModel" NOT NULL DEFAULT 'LOW',
    "assumptions" JSONB,
    "summary" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_strategy_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trade_strategy_run_days" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cash_isk" DECIMAL(28,2) NOT NULL,
    "inventory_cost_isk" DECIMAL(28,2) NOT NULL,
    "inventory_mark_isk" DECIMAL(28,2) NOT NULL,
    "realized_profit_isk" DECIMAL(28,2) NOT NULL,
    "unrealized_profit_isk" DECIMAL(28,2) NOT NULL,
    "nav_isk" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_strategy_run_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trade_strategy_run_positions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "destination_station_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "planned_units" INTEGER NOT NULL,
    "buy_unit_price_isk" DECIMAL(28,2) NOT NULL,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "units_remaining" INTEGER NOT NULL DEFAULT 0,
    "cost_basis_isk_remaining" DECIMAL(28,2) NOT NULL,
    "realized_profit_isk" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_strategy_run_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategies_name_key" ON "public"."trade_strategies"("name");

-- CreateIndex
CREATE INDEX "trade_strategies_is_active_idx" ON "public"."trade_strategies"("is_active");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_strategy_id_idx" ON "public"."trade_strategy_runs"("strategy_id");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_status_idx" ON "public"."trade_strategy_runs"("status");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_start_date_end_date_idx" ON "public"."trade_strategy_runs"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategy_run_days_run_id_date_key" ON "public"."trade_strategy_run_days"("run_id", "date");

-- CreateIndex
CREATE INDEX "trade_strategy_run_days_run_id_idx" ON "public"."trade_strategy_run_days"("run_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_days_date_idx" ON "public"."trade_strategy_run_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategy_run_positions_run_id_destination_station_id_type_id_key" ON "public"."trade_strategy_run_positions"("run_id", "destination_station_id", "type_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_run_id_idx" ON "public"."trade_strategy_run_positions"("run_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_destination_station_id_idx" ON "public"."trade_strategy_run_positions"("destination_station_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_type_id_idx" ON "public"."trade_strategy_run_positions"("type_id");

-- AddForeignKey
ALTER TABLE "public"."trade_strategy_runs" ADD CONSTRAINT "trade_strategy_runs_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."trade_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trade_strategy_run_days" ADD CONSTRAINT "trade_strategy_run_days_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."trade_strategy_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trade_strategy_run_positions" ADD CONSTRAINT "trade_strategy_run_positions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."trade_strategy_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trade_strategy_run_positions" ADD CONSTRAINT "trade_strategy_run_positions_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

