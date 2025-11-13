-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CharacterRole" AS ENUM ('USER', 'LOGISTICS');

-- CreateEnum
CREATE TYPE "public"."CharacterManagedBy" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."CharacterFunction" AS ENUM ('SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "public"."CharacterLocation" AS ENUM ('JITA', 'DODIXIE', 'AMARR', 'HEK', 'RENS', 'CN');

-- CreateEnum
CREATE TYPE "public"."ParticipationStatus" AS ENUM ('AWAITING_INVESTMENT', 'AWAITING_VALIDATION', 'OPTED_IN', 'OPTED_OUT', 'AWAITING_PAYOUT', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."CycleStatus" AS ENUM ('PLANNED', 'OPEN', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."item_types" (
    "type_id" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL,
    "type_name" TEXT NOT NULL,
    "volume_m3" DECIMAL(28,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "public"."regions" (
    "region_id" INTEGER NOT NULL,
    "region_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);

-- CreateTable
CREATE TABLE "public"."solar_systems" (
    "solar_system_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "solar_system_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("solar_system_id")
);

-- CreateTable
CREATE TABLE "public"."stations" (
    "station_id" INTEGER NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "station_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "public"."tracked_stations" (
    "id" TEXT NOT NULL,
    "station_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_order_trades_daily" (
    "scan_date" DATE NOT NULL,
    "location_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "region_id" INTEGER NOT NULL,
    "has_gone" BOOLEAN NOT NULL,
    "amount" INTEGER NOT NULL,
    "high" DECIMAL(28,2) NOT NULL,
    "low" DECIMAL(28,2) NOT NULL,
    "avg" DECIMAL(28,2) NOT NULL,
    "order_num" INTEGER NOT NULL,
    "isk_value" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_order_trades_daily_pkey" PRIMARY KEY ("scan_date","location_id","type_id","is_buy_order")
);

-- CreateTable
CREATE TABLE "public"."esi_cache_entries" (
    "key" TEXT NOT NULL,
    "etag" TEXT,
    "last_modified" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" INTEGER,
    "body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esi_cache_entries_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."app_users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "primary_character_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."eve_characters" (
    "character_id" INTEGER NOT NULL,
    "character_name" TEXT NOT NULL,
    "owner_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "role" "public"."CharacterRole" NOT NULL DEFAULT 'USER',
    "function" "public"."CharacterFunction",
    "location" "public"."CharacterLocation",
    "managed_by" "public"."CharacterManagedBy" NOT NULL DEFAULT 'USER',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_characters_pkey" PRIMARY KEY ("character_id")
);

-- CreateTable
CREATE TABLE "public"."character_tokens" (
    "id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "token_type" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "last_refresh_at" TIMESTAMP(3),
    "refresh_fail_at" TIMESTAMP(3),
    "refresh_fail_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" "public"."CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "started_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "initial_injection_isk" DECIMAL(28,2),
    "initial_capital_isk" DECIMAL(28,2),

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycle_capital_cache" (
    "cycle_id" TEXT NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_capital_cache_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "public"."cycle_ledger" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_type" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "memo" TEXT,
    "participation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wallet_transactions" (
    "character_id" INTEGER NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "is_buy" BOOLEAN NOT NULL,
    "location_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "journal_ref_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("character_id","transaction_id")
);

-- CreateTable
CREATE TABLE "public"."wallet_journal" (
    "character_id" INTEGER NOT NULL,
    "journal_id" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ref_type" TEXT NOT NULL,
    "amount" DECIMAL(28,2) NOT NULL,
    "balance" DECIMAL(28,2),
    "context_id" BIGINT,
    "context_id_type" TEXT,
    "description" TEXT,
    "reason" TEXT,
    "first_party_id" INTEGER,
    "second_party_id" INTEGER,
    "tax" DECIMAL(28,2),
    "tax_receiver_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_journal_pkey" PRIMARY KEY ("character_id","journal_id")
);

-- CreateTable
CREATE TABLE "public"."cycle_participations" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT,
    "character_name" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "memo" TEXT NOT NULL,
    "status" "public"."ParticipationStatus" NOT NULL,
    "wallet_journal_id" BIGINT,
    "validated_at" TIMESTAMP(3),
    "opted_out_at" TIMESTAMP(3),
    "refund_amount_isk" DECIMAL(28,2),
    "refunded_at" TIMESTAMP(3),
    "payout_amount_isk" DECIMAL(28,2),
    "payout_paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "user_id" TEXT,
    "return_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycle_lines" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "destination_station_id" INTEGER NOT NULL,
    "planned_units" INTEGER NOT NULL,
    "units_bought" INTEGER NOT NULL DEFAULT 0,
    "buy_cost_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "sales_gross_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "sales_tax_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "sales_net_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "broker_fees_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "relist_fees_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "current_sell_price_isk" DECIMAL(28,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_rollover" BOOLEAN NOT NULL DEFAULT false,
    "rollover_from_cycle_id" TEXT,
    "rollover_from_line_id" TEXT,

    CONSTRAINT "cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buy_allocations" (
    "id" TEXT NOT NULL,
    "wallet_character_id" INTEGER,
    "wallet_transaction_id" BIGINT,
    "line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_rollover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "buy_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sell_allocations" (
    "id" TEXT NOT NULL,
    "wallet_character_id" INTEGER,
    "wallet_transaction_id" BIGINT,
    "line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "revenue_isk" DECIMAL(28,2) NOT NULL,
    "tax_isk" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_rollover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sell_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycle_fee_events" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_fee_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycle_snapshots" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "wallet_cash_isk" DECIMAL(28,2) NOT NULL,
    "inventory_isk" DECIMAL(28,2) NOT NULL,
    "cycle_profit_isk" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."committed_packages" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "package_index" INTEGER NOT NULL,
    "destination_station_id" INTEGER NOT NULL,
    "destination_name" TEXT,
    "collateral_isk" DECIMAL(28,2) NOT NULL,
    "shipping_cost_isk" DECIMAL(28,2) NOT NULL,
    "estimated_profit_isk" DECIMAL(28,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_at" TIMESTAMP(3),
    "collateral_recovered_isk" DECIMAL(28,2),
    "failure_memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committed_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."committed_package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "unit_cost" DECIMAL(28,2) NOT NULL,
    "unit_profit" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committed_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."package_cycle_lines" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "cycle_line_id" TEXT NOT NULL,
    "units_committed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solar_systems_region_id_idx" ON "public"."solar_systems"("region_id");

-- CreateIndex
CREATE INDEX "stations_solar_system_id_idx" ON "public"."stations"("solar_system_id");

-- CreateIndex
CREATE INDEX "tracked_stations_station_id_idx" ON "public"."tracked_stations"("station_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_region_id_idx" ON "public"."market_order_trades_daily"("region_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_location_id_idx" ON "public"."market_order_trades_daily"("location_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_type_id_idx" ON "public"."market_order_trades_daily"("type_id");

-- CreateIndex
CREATE INDEX "esi_cache_entries_expires_at_idx" ON "public"."esi_cache_entries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "public"."app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_primary_character_id_key" ON "public"."app_users"("primary_character_id");

-- CreateIndex
CREATE INDEX "eve_characters_owner_hash_idx" ON "public"."eve_characters"("owner_hash");

-- CreateIndex
CREATE INDEX "eve_characters_user_id_idx" ON "public"."eve_characters"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_tokens_character_id_key" ON "public"."character_tokens"("character_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_cycle_id_idx" ON "public"."cycle_ledger"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_participation_id_idx" ON "public"."cycle_ledger"("participation_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_entry_type_idx" ON "public"."cycle_ledger"("entry_type");

-- CreateIndex
CREATE INDEX "wallet_transactions_character_id_idx" ON "public"."wallet_transactions"("character_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_date_idx" ON "public"."wallet_transactions"("date");

-- CreateIndex
CREATE INDEX "wallet_journal_character_id_idx" ON "public"."wallet_journal"("character_id");

-- CreateIndex
CREATE INDEX "wallet_journal_date_idx" ON "public"."wallet_journal"("date");

-- CreateIndex
CREATE INDEX "cycle_participations_cycle_id_idx" ON "public"."cycle_participations"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_participations_cycle_id_user_id_key" ON "public"."cycle_participations"("cycle_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "public"."oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_state_idx" ON "public"."oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "public"."oauth_states"("expires_at");

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_idx" ON "public"."cycle_lines"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_lines_type_id_idx" ON "public"."cycle_lines"("type_id");

-- CreateIndex
CREATE INDEX "cycle_lines_destination_station_id_idx" ON "public"."cycle_lines"("destination_station_id");

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_type_id_idx" ON "public"."cycle_lines"("cycle_id", "type_id");

-- CreateIndex
CREATE INDEX "cycle_lines_rollover_from_cycle_id_idx" ON "public"."cycle_lines"("rollover_from_cycle_id");

-- CreateIndex
CREATE INDEX "buy_allocations_line_id_idx" ON "public"."buy_allocations"("line_id");

-- CreateIndex
CREATE INDEX "buy_allocations_wallet_character_id_wallet_transaction_id_idx" ON "public"."buy_allocations"("wallet_character_id", "wallet_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "buy_allocations_wallet_character_id_wallet_transaction_id_l_key" ON "public"."buy_allocations"("wallet_character_id", "wallet_transaction_id", "line_id");

-- CreateIndex
CREATE INDEX "sell_allocations_line_id_idx" ON "public"."sell_allocations"("line_id");

-- CreateIndex
CREATE INDEX "sell_allocations_wallet_character_id_wallet_transaction_id_idx" ON "public"."sell_allocations"("wallet_character_id", "wallet_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "sell_allocations_wallet_character_id_wallet_transaction_id__key" ON "public"."sell_allocations"("wallet_character_id", "wallet_transaction_id", "line_id");

-- CreateIndex
CREATE INDEX "cycle_fee_events_cycle_id_idx" ON "public"."cycle_fee_events"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_fee_events_occurred_at_idx" ON "public"."cycle_fee_events"("occurred_at");

-- CreateIndex
CREATE INDEX "cycle_snapshots_cycle_id_idx" ON "public"."cycle_snapshots"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_snapshots_snapshot_at_idx" ON "public"."cycle_snapshots"("snapshot_at");

-- CreateIndex
CREATE INDEX "committed_packages_cycle_id_idx" ON "public"."committed_packages"("cycle_id");

-- CreateIndex
CREATE INDEX "committed_packages_status_idx" ON "public"."committed_packages"("status");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_idx" ON "public"."committed_package_items"("package_id");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_type_id_idx" ON "public"."committed_package_items"("package_id", "type_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_package_id_idx" ON "public"."package_cycle_lines"("package_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_cycle_line_id_idx" ON "public"."package_cycle_lines"("cycle_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_cycle_lines_package_id_cycle_line_id_key" ON "public"."package_cycle_lines"("package_id", "cycle_line_id");

-- AddForeignKey
ALTER TABLE "public"."solar_systems" ADD CONSTRAINT "solar_systems_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stations" ADD CONSTRAINT "stations_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "public"."solar_systems"("solar_system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tracked_stations" ADD CONSTRAINT "tracked_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."app_users" ADD CONSTRAINT "app_users_primary_character_id_fkey" FOREIGN KEY ("primary_character_id") REFERENCES "public"."eve_characters"("character_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."eve_characters" ADD CONSTRAINT "eve_characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_tokens" ADD CONSTRAINT "character_tokens_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_capital_cache" ADD CONSTRAINT "cycle_capital_cache_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "public"."cycle_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_participations" ADD CONSTRAINT "cycle_participations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_lines" ADD CONSTRAINT "cycle_lines_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buy_allocations" ADD CONSTRAINT "buy_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "public"."cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sell_allocations" ADD CONSTRAINT "sell_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "public"."cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_fee_events" ADD CONSTRAINT "cycle_fee_events_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_snapshots" ADD CONSTRAINT "cycle_snapshots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."committed_packages" ADD CONSTRAINT "committed_packages_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."committed_package_items" ADD CONSTRAINT "committed_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_cycle_line_id_fkey" FOREIGN KEY ("cycle_line_id") REFERENCES "public"."cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

