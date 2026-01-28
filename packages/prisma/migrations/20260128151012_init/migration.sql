-- CreateEnum
CREATE TYPE "CharacterRole" AS ENUM ('USER', 'LOGISTICS');

-- CreateEnum
CREATE TYPE "CharacterManagedBy" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CharacterFunction" AS ENUM ('SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "CharacterLocation" AS ENUM ('JITA', 'DODIXIE', 'AMARR', 'HEK', 'RENS', 'CN');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('AWAITING_INVESTMENT', 'AWAITING_VALIDATION', 'OPTED_IN', 'OPTED_OUT', 'AWAITING_PAYOUT', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ParameterProfileScope" AS ENUM ('LIQUIDITY', 'ARBITRAGE', 'PLANNER');

-- CreateEnum
CREATE TYPE "TradeStrategyRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeStrategySellModel" AS ENUM ('VOLUME_SHARE', 'CALIBRATED_CAPTURE');

-- CreateEnum
CREATE TYPE "TradeStrategyPriceModel" AS ENUM ('LOW', 'AVG', 'HIGH');

-- CreateEnum
CREATE TYPE "RolloverType" AS ENUM ('FULL_PAYOUT', 'INITIAL_ONLY', 'CUSTOM_AMOUNT');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNED', 'OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('DISCORD_DM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CYCLE_PLANNED', 'CYCLE_STARTED', 'CYCLE_RESULTS', 'CYCLE_PAYOUT_SENT', 'SKILL_PLAN_REMAP_REMINDER', 'SKILL_PLAN_COMPLETION', 'PLEX_ENDING', 'MCT_ENDING', 'BOOSTER_ENDING', 'TRAINING_QUEUE_IDLE', 'SKILL_FARM_EXTRACTOR_READY', 'SKILL_FARM_QUEUE_LOW');

-- CreateEnum
CREATE TYPE "EveAccountSubscriptionType" AS ENUM ('PLEX', 'MCT');

-- CreateTable
CREATE TABLE "auto_rollover_settings" (
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_rollover_type" "RolloverType" NOT NULL DEFAULT 'INITIAL_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_rollover_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "item_types" (
    "type_id" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL,
    "type_name" TEXT NOT NULL,
    "volume_m3" DECIMAL(28,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "regions" (
    "region_id" INTEGER NOT NULL,
    "region_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);

-- CreateTable
CREATE TABLE "solar_systems" (
    "solar_system_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "solar_system_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("solar_system_id")
);

-- CreateTable
CREATE TABLE "stations" (
    "station_id" INTEGER NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "station_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "tracked_stations" (
    "id" TEXT NOT NULL,
    "station_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_order_trades_daily" (
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

    CONSTRAINT "market_order_trades_daily_pkey" PRIMARY KEY ("scan_date","location_id","type_id","is_buy_order","has_gone")
);

-- CreateTable
CREATE TABLE "esi_cache_entries" (
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
CREATE TABLE "self_market_snapshot_latest" (
    "location_id" BIGINT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "orders" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_market_snapshot_latest_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "self_market_order_trades_daily" (
    "scan_date" DATE NOT NULL,
    "location_id" BIGINT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "has_gone" BOOLEAN NOT NULL,
    "amount" BIGINT NOT NULL,
    "high" DECIMAL(28,2) NOT NULL,
    "low" DECIMAL(28,2) NOT NULL,
    "avg" DECIMAL(28,2) NOT NULL,
    "order_num" BIGINT NOT NULL,
    "isk_value" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_market_order_trades_daily_pkey" PRIMARY KEY ("scan_date","location_id","type_id","is_buy_order","has_gone")
);

-- CreateTable
CREATE TABLE "npc_market_station_baselines" (
    "station_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "baseline_id" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npc_market_station_baselines_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "npc_market_region_types_snapshots" (
    "region_id" INTEGER NOT NULL,
    "baseline_id" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "type_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npc_market_region_types_snapshots_pkey" PRIMARY KEY ("region_id","baseline_id")
);

-- CreateTable
CREATE TABLE "npc_market_snapshots" (
    "station_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "baseline_id" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "order_count" INTEGER NOT NULL,
    "best_price" DECIMAL(28,2),
    "orders" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npc_market_snapshots_pkey" PRIMARY KEY ("station_id","type_id","is_buy_order","baseline_id")
);

-- CreateTable
CREATE TABLE "npc_market_order_trades_daily" (
    "scan_date" DATE NOT NULL,
    "station_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "has_gone" BOOLEAN NOT NULL,
    "amount" BIGINT NOT NULL,
    "high" DECIMAL(28,2) NOT NULL,
    "low" DECIMAL(28,2) NOT NULL,
    "avg" DECIMAL(28,2) NOT NULL,
    "order_num" BIGINT NOT NULL,
    "isk_value" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npc_market_order_trades_daily_pkey" PRIMARY KEY ("scan_date","station_id","type_id","is_buy_order","has_gone")
);

-- CreateTable
CREATE TABLE "npc_market_runs" (
    "baseline_id" TEXT NOT NULL,
    "station_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "type_count" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "npc_market_runs_pkey" PRIMARY KEY ("baseline_id")
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "primary_character_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "enabled_features" JSONB,
    "tradecraft_max_participation_isk" DECIMAL(28,2),
    "tradecraft_principal_cap_isk" DECIMAL(28,2),
    "tradecraft_maximum_cap_isk" DECIMAL(28,2),

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eve_characters" (
    "character_id" INTEGER NOT NULL,
    "character_name" TEXT NOT NULL,
    "owner_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "eve_account_id" TEXT,
    "role" "CharacterRole" NOT NULL DEFAULT 'USER',
    "function" "CharacterFunction",
    "location" "CharacterLocation",
    "managed_by" "CharacterManagedBy" NOT NULL DEFAULT 'USER',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_characters_pkey" PRIMARY KEY ("character_id")
);

-- CreateTable
CREATE TABLE "character_tokens" (
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
CREATE TABLE "eve_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eve_account_subscriptions" (
    "id" TEXT NOT NULL,
    "eve_account_id" TEXT NOT NULL,
    "type" "EveAccountSubscriptionType" NOT NULL,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "renewal_cycle_days" INTEGER,
    "expected_cost_isk" DECIMAL(28,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_account_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_booster_periods" (
    "id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "booster_name" TEXT NOT NULL,
    "source" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_booster_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_farm_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plex_price_isk" DECIMAL(28,2),
    "plex_per_omega" INTEGER,
    "plex_per_mct" INTEGER,
    "extractor_price_isk" DECIMAL(28,2),
    "injector_price_isk" DECIMAL(28,2),
    "booster_cost_per_cycle_isk" DECIMAL(28,2),
    "use_boosters" BOOLEAN NOT NULL DEFAULT true,
    "sales_tax_percent" DECIMAL(5,2),
    "broker_fee_percent" DECIMAL(5,2),
    "sold_via_contracts" BOOLEAN NOT NULL DEFAULT false,
    "cycle_days" INTEGER,
    "management_minutes_per_cycle" INTEGER,
    "extraction_target_skill_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_farm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_farm_character_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "is_candidate" BOOLEAN NOT NULL DEFAULT false,
    "is_active_farm" BOOLEAN NOT NULL DEFAULT false,
    "farm_plan_id" TEXT,
    "include_in_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_farm_character_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "total_estimated_time_seconds" INTEGER,
    "tags" JSONB,
    "archived_at" TIMESTAMP(3),
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_plan_steps" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "target_level" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_plan_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_plan_assignments" (
    "id" TEXT NOT NULL,
    "skill_plan_id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_plan_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" "CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "started_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "initial_injection_isk" DECIMAL(28,2),
    "initial_capital_isk" DECIMAL(28,2),

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_capital_cache" (
    "cycle_id" TEXT NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_capital_cache_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "cycle_ledger" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_type" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "memo" TEXT,
    "beneficiary_type" TEXT,
    "beneficiary_character_id" INTEGER,
    "jingle_yield_program_id" TEXT,
    "participation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
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
CREATE TABLE "wallet_journal" (
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
CREATE TABLE "cycle_participations" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT,
    "character_name" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "user_principal_isk" DECIMAL(28,2),
    "memo" TEXT NOT NULL,
    "status" "ParticipationStatus" NOT NULL,
    "wallet_journal_id" BIGINT,
    "validated_at" TIMESTAMP(3),
    "opted_out_at" TIMESTAMP(3),
    "refund_amount_isk" DECIMAL(28,2),
    "refunded_at" TIMESTAMP(3),
    "payout_amount_isk" DECIMAL(28,2),
    "payout_paid_at" TIMESTAMP(3),
    "rollover_deducted_isk" DECIMAL(28,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rollover_type" "RolloverType",
    "rollover_requested_amount_isk" DECIMAL(28,2),
    "rollover_from_participation_id" TEXT,
    "jingle_yield_program_id" TEXT,

    CONSTRAINT "cycle_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jingle_yield_programs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "admin_character_id" INTEGER NOT NULL,
    "root_participation_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "locked_principal_isk" DECIMAL(28,2) NOT NULL,
    "cumulative_interest_isk" DECIMAL(28,2) NOT NULL DEFAULT 0,
    "target_interest_isk" DECIMAL(28,2) NOT NULL DEFAULT 2000000000,
    "start_cycle_id" TEXT NOT NULL,
    "min_cycles" INTEGER NOT NULL DEFAULT 12,
    "completed_cycle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jingle_yield_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
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
CREATE TABLE "discord_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT,
    "avatar_url" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_lines" (
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
    "listed_units" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_rollover" BOOLEAN NOT NULL DEFAULT false,
    "rollover_from_cycle_id" TEXT,
    "rollover_from_line_id" TEXT,

    CONSTRAINT "cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_allocations" (
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
CREATE TABLE "sell_allocations" (
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
CREATE TABLE "cycle_fee_events" (
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
CREATE TABLE "cycle_snapshots" (
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
CREATE TABLE "committed_packages" (
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
CREATE TABLE "committed_package_items" (
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
CREATE TABLE "package_cycle_lines" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "cycle_line_id" TEXT NOT NULL,
    "units_committed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_definitions" (
    "type_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name_en" TEXT,
    "description_en" TEXT,
    "rank" INTEGER,
    "primary_attribute" TEXT,
    "secondary_attribute" TEXT,
    "prerequisite1_id" INTEGER,
    "prerequisite1_level" INTEGER,
    "prerequisite2_id" INTEGER,
    "prerequisite2_level" INTEGER,
    "prerequisite3_id" INTEGER,
    "prerequisite3_level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_definitions_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "parameter_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ParameterProfileScope" NOT NULL,
    "params" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "parameter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_strategies" (
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
CREATE TABLE "trade_strategy_runs" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "status" "TradeStrategyRunStatus" NOT NULL DEFAULT 'QUEUED',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "initial_capital_isk" DECIMAL(28,2) NOT NULL,
    "sell_model" "TradeStrategySellModel" NOT NULL,
    "sell_share_pct" DECIMAL(10,6),
    "price_model" "TradeStrategyPriceModel" NOT NULL DEFAULT 'LOW',
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
CREATE TABLE "trade_strategy_run_days" (
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
CREATE TABLE "trade_strategy_run_positions" (
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
CREATE INDEX "solar_systems_region_id_idx" ON "solar_systems"("region_id");

-- CreateIndex
CREATE INDEX "stations_solar_system_id_idx" ON "stations"("solar_system_id");

-- CreateIndex
CREATE INDEX "tracked_stations_station_id_idx" ON "tracked_stations"("station_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_region_id_idx" ON "market_order_trades_daily"("region_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_location_id_idx" ON "market_order_trades_daily"("location_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_type_id_idx" ON "market_order_trades_daily"("type_id");

-- CreateIndex
CREATE INDEX "esi_cache_entries_expires_at_idx" ON "esi_cache_entries"("expires_at");

-- CreateIndex
CREATE INDEX "self_market_snapshot_latest_observed_at_idx" ON "self_market_snapshot_latest"("observed_at");

-- CreateIndex
CREATE INDEX "self_market_order_trades_daily_scan_date_idx" ON "self_market_order_trades_daily"("scan_date");

-- CreateIndex
CREATE INDEX "self_market_order_trades_daily_location_id_idx" ON "self_market_order_trades_daily"("location_id");

-- CreateIndex
CREATE INDEX "self_market_order_trades_daily_type_id_idx" ON "self_market_order_trades_daily"("type_id");

-- CreateIndex
CREATE INDEX "npc_market_station_baselines_region_id_idx" ON "npc_market_station_baselines"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "npc_market_station_baselines_baseline_id_key" ON "npc_market_station_baselines"("baseline_id");

-- CreateIndex
CREATE INDEX "npc_market_region_types_snapshots_observed_at_idx" ON "npc_market_region_types_snapshots"("observed_at");

-- CreateIndex
CREATE INDEX "npc_market_snapshots_station_id_baseline_id_idx" ON "npc_market_snapshots"("station_id", "baseline_id");

-- CreateIndex
CREATE INDEX "npc_market_snapshots_region_id_idx" ON "npc_market_snapshots"("region_id");

-- CreateIndex
CREATE INDEX "npc_market_snapshots_type_id_idx" ON "npc_market_snapshots"("type_id");

-- CreateIndex
CREATE INDEX "npc_market_order_trades_daily_scan_date_idx" ON "npc_market_order_trades_daily"("scan_date");

-- CreateIndex
CREATE INDEX "npc_market_order_trades_daily_station_id_idx" ON "npc_market_order_trades_daily"("station_id");

-- CreateIndex
CREATE INDEX "npc_market_order_trades_daily_type_id_idx" ON "npc_market_order_trades_daily"("type_id");

-- CreateIndex
CREATE INDEX "npc_market_runs_station_id_started_at_idx" ON "npc_market_runs"("station_id", "started_at");

-- CreateIndex
CREATE INDEX "npc_market_runs_region_id_started_at_idx" ON "npc_market_runs"("region_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_primary_character_id_key" ON "app_users"("primary_character_id");

-- CreateIndex
CREATE INDEX "eve_characters_owner_hash_idx" ON "eve_characters"("owner_hash");

-- CreateIndex
CREATE INDEX "eve_characters_user_id_idx" ON "eve_characters"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_tokens_character_id_key" ON "character_tokens"("character_id");

-- CreateIndex
CREATE INDEX "eve_accounts_user_id_idx" ON "eve_accounts"("user_id");

-- CreateIndex
CREATE INDEX "eve_account_subscriptions_eve_account_id_idx" ON "eve_account_subscriptions"("eve_account_id");

-- CreateIndex
CREATE INDEX "character_booster_periods_character_id_idx" ON "character_booster_periods"("character_id");

-- CreateIndex
CREATE INDEX "skill_farm_settings_user_id_idx" ON "skill_farm_settings"("user_id");

-- CreateIndex
CREATE INDEX "skill_farm_character_configs_character_id_idx" ON "skill_farm_character_configs"("character_id");

-- CreateIndex
CREATE INDEX "skill_farm_character_configs_farm_plan_id_idx" ON "skill_farm_character_configs"("farm_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_farm_character_configs_user_id_character_id_key" ON "skill_farm_character_configs"("user_id", "character_id");

-- CreateIndex
CREATE INDEX "skill_plans_user_id_idx" ON "skill_plans"("user_id");

-- CreateIndex
CREATE INDEX "skill_plan_steps_plan_id_idx" ON "skill_plan_steps"("plan_id");

-- CreateIndex
CREATE INDEX "skill_plan_assignments_skill_plan_id_idx" ON "skill_plan_assignments"("skill_plan_id");

-- CreateIndex
CREATE INDEX "skill_plan_assignments_character_id_idx" ON "skill_plan_assignments"("character_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_cycle_id_idx" ON "cycle_ledger"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_participation_id_idx" ON "cycle_ledger"("participation_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_entry_type_idx" ON "cycle_ledger"("entry_type");

-- CreateIndex
CREATE INDEX "cycle_ledger_beneficiary_character_id_idx" ON "cycle_ledger"("beneficiary_character_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_jingle_yield_program_id_idx" ON "cycle_ledger"("jingle_yield_program_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_character_id_idx" ON "wallet_transactions"("character_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_date_idx" ON "wallet_transactions"("date");

-- CreateIndex
CREATE INDEX "wallet_journal_character_id_idx" ON "wallet_journal"("character_id");

-- CreateIndex
CREATE INDEX "wallet_journal_date_idx" ON "wallet_journal"("date");

-- CreateIndex
CREATE INDEX "cycle_participations_cycle_id_idx" ON "cycle_participations"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_participations_rollover_from_participation_id_idx" ON "cycle_participations"("rollover_from_participation_id");

-- CreateIndex
CREATE INDEX "cycle_participations_jingle_yield_program_id_idx" ON "cycle_participations"("jingle_yield_program_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_participations_cycle_id_user_id_key" ON "cycle_participations"("cycle_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jingle_yield_programs_root_participation_id_key" ON "jingle_yield_programs"("root_participation_id");

-- CreateIndex
CREATE INDEX "jingle_yield_programs_user_id_idx" ON "jingle_yield_programs"("user_id");

-- CreateIndex
CREATE INDEX "jingle_yield_programs_admin_character_id_idx" ON "jingle_yield_programs"("admin_character_id");

-- CreateIndex
CREATE INDEX "jingle_yield_programs_start_cycle_id_idx" ON "jingle_yield_programs"("start_cycle_id");

-- CreateIndex
CREATE INDEX "jingle_yield_programs_completed_cycle_id_idx" ON "jingle_yield_programs"("completed_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_state_idx" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");

-- CreateIndex
CREATE INDEX "discord_accounts_user_id_idx" ON "discord_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_accounts_discord_user_id_key" ON "discord_accounts"("discord_user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_notification_type_key" ON "notification_preferences"("user_id", "channel", "notification_type");

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_idx" ON "cycle_lines"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_lines_type_id_idx" ON "cycle_lines"("type_id");

-- CreateIndex
CREATE INDEX "cycle_lines_destination_station_id_idx" ON "cycle_lines"("destination_station_id");

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_type_id_idx" ON "cycle_lines"("cycle_id", "type_id");

-- CreateIndex
CREATE INDEX "cycle_lines_rollover_from_cycle_id_idx" ON "cycle_lines"("rollover_from_cycle_id");

-- CreateIndex
CREATE INDEX "buy_allocations_line_id_idx" ON "buy_allocations"("line_id");

-- CreateIndex
CREATE INDEX "buy_allocations_wallet_character_id_wallet_transaction_id_idx" ON "buy_allocations"("wallet_character_id", "wallet_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "buy_allocations_wallet_character_id_wallet_transaction_id_l_key" ON "buy_allocations"("wallet_character_id", "wallet_transaction_id", "line_id");

-- CreateIndex
CREATE INDEX "sell_allocations_line_id_idx" ON "sell_allocations"("line_id");

-- CreateIndex
CREATE INDEX "sell_allocations_wallet_character_id_wallet_transaction_id_idx" ON "sell_allocations"("wallet_character_id", "wallet_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "sell_allocations_wallet_character_id_wallet_transaction_id__key" ON "sell_allocations"("wallet_character_id", "wallet_transaction_id", "line_id");

-- CreateIndex
CREATE INDEX "cycle_fee_events_cycle_id_idx" ON "cycle_fee_events"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_fee_events_occurred_at_idx" ON "cycle_fee_events"("occurred_at");

-- CreateIndex
CREATE INDEX "cycle_snapshots_cycle_id_idx" ON "cycle_snapshots"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_snapshots_snapshot_at_idx" ON "cycle_snapshots"("snapshot_at");

-- CreateIndex
CREATE INDEX "committed_packages_cycle_id_idx" ON "committed_packages"("cycle_id");

-- CreateIndex
CREATE INDEX "committed_packages_status_idx" ON "committed_packages"("status");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_idx" ON "committed_package_items"("package_id");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_type_id_idx" ON "committed_package_items"("package_id", "type_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_package_id_idx" ON "package_cycle_lines"("package_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_cycle_line_id_idx" ON "package_cycle_lines"("cycle_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_cycle_lines_package_id_cycle_line_id_key" ON "package_cycle_lines"("package_id", "cycle_line_id");

-- CreateIndex
CREATE INDEX "skill_definitions_group_id_idx" ON "skill_definitions"("group_id");

-- CreateIndex
CREATE INDEX "parameter_profiles_scope_idx" ON "parameter_profiles"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "parameter_profiles_scope_name_key" ON "parameter_profiles"("scope", "name");

-- CreateIndex
CREATE INDEX "trade_strategies_is_active_idx" ON "trade_strategies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategies_name_key" ON "trade_strategies"("name");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_strategy_id_idx" ON "trade_strategy_runs"("strategy_id");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_status_idx" ON "trade_strategy_runs"("status");

-- CreateIndex
CREATE INDEX "trade_strategy_runs_start_date_end_date_idx" ON "trade_strategy_runs"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "trade_strategy_run_days_run_id_idx" ON "trade_strategy_run_days"("run_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_days_date_idx" ON "trade_strategy_run_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategy_run_days_run_id_date_key" ON "trade_strategy_run_days"("run_id", "date");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_run_id_idx" ON "trade_strategy_run_positions"("run_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_destination_station_id_idx" ON "trade_strategy_run_positions"("destination_station_id");

-- CreateIndex
CREATE INDEX "trade_strategy_run_positions_type_id_idx" ON "trade_strategy_run_positions"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_strategy_run_positions_run_id_destination_station_id__key" ON "trade_strategy_run_positions"("run_id", "destination_station_id", "type_id");

-- AddForeignKey
ALTER TABLE "auto_rollover_settings" ADD CONSTRAINT "auto_rollover_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_systems" ADD CONSTRAINT "solar_systems_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("solar_system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_stations" ADD CONSTRAINT "tracked_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_station_baselines" ADD CONSTRAINT "npc_market_station_baselines_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_station_baselines" ADD CONSTRAINT "npc_market_station_baselines_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_region_types_snapshots" ADD CONSTRAINT "npc_market_region_types_snapshots_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_snapshots" ADD CONSTRAINT "npc_market_snapshots_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_snapshots" ADD CONSTRAINT "npc_market_snapshots_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_snapshots" ADD CONSTRAINT "npc_market_snapshots_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_order_trades_daily" ADD CONSTRAINT "npc_market_order_trades_daily_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_order_trades_daily" ADD CONSTRAINT "npc_market_order_trades_daily_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_runs" ADD CONSTRAINT "npc_market_runs_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npc_market_runs" ADD CONSTRAINT "npc_market_runs_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_primary_character_id_fkey" FOREIGN KEY ("primary_character_id") REFERENCES "eve_characters"("character_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eve_characters" ADD CONSTRAINT "eve_characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eve_characters" ADD CONSTRAINT "eve_characters_eve_account_id_fkey" FOREIGN KEY ("eve_account_id") REFERENCES "eve_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_tokens" ADD CONSTRAINT "character_tokens_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eve_accounts" ADD CONSTRAINT "eve_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eve_account_subscriptions" ADD CONSTRAINT "eve_account_subscriptions_eve_account_id_fkey" FOREIGN KEY ("eve_account_id") REFERENCES "eve_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_booster_periods" ADD CONSTRAINT "character_booster_periods_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_farm_settings" ADD CONSTRAINT "skill_farm_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_farm_character_configs" ADD CONSTRAINT "skill_farm_character_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_farm_character_configs" ADD CONSTRAINT "skill_farm_character_configs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_farm_character_configs" ADD CONSTRAINT "skill_farm_character_configs_farm_plan_id_fkey" FOREIGN KEY ("farm_plan_id") REFERENCES "skill_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_plans" ADD CONSTRAINT "skill_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_plan_steps" ADD CONSTRAINT "skill_plan_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "skill_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_plan_assignments" ADD CONSTRAINT "skill_plan_assignments_skill_plan_id_fkey" FOREIGN KEY ("skill_plan_id") REFERENCES "skill_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_plan_assignments" ADD CONSTRAINT "skill_plan_assignments_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_capital_cache" ADD CONSTRAINT "cycle_capital_cache_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_ledger" ADD CONSTRAINT "cycle_ledger_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_ledger" ADD CONSTRAINT "cycle_ledger_beneficiary_character_id_fkey" FOREIGN KEY ("beneficiary_character_id") REFERENCES "eve_characters"("character_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_ledger" ADD CONSTRAINT "cycle_ledger_jingle_yield_program_id_fkey" FOREIGN KEY ("jingle_yield_program_id") REFERENCES "jingle_yield_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_ledger" ADD CONSTRAINT "cycle_ledger_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "cycle_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_participations" ADD CONSTRAINT "cycle_participations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_participations" ADD CONSTRAINT "cycle_participations_rollover_from_participation_id_fkey" FOREIGN KEY ("rollover_from_participation_id") REFERENCES "cycle_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_participations" ADD CONSTRAINT "cycle_participations_jingle_yield_program_id_fkey" FOREIGN KEY ("jingle_yield_program_id") REFERENCES "jingle_yield_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jingle_yield_programs" ADD CONSTRAINT "jingle_yield_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jingle_yield_programs" ADD CONSTRAINT "jingle_yield_programs_admin_character_id_fkey" FOREIGN KEY ("admin_character_id") REFERENCES "eve_characters"("character_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jingle_yield_programs" ADD CONSTRAINT "jingle_yield_programs_root_participation_id_fkey" FOREIGN KEY ("root_participation_id") REFERENCES "cycle_participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jingle_yield_programs" ADD CONSTRAINT "jingle_yield_programs_start_cycle_id_fkey" FOREIGN KEY ("start_cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jingle_yield_programs" ADD CONSTRAINT "jingle_yield_programs_completed_cycle_id_fkey" FOREIGN KEY ("completed_cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_accounts" ADD CONSTRAINT "discord_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_lines" ADD CONSTRAINT "cycle_lines_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_allocations" ADD CONSTRAINT "buy_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_allocations" ADD CONSTRAINT "sell_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_fee_events" ADD CONSTRAINT "cycle_fee_events_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_snapshots" ADD CONSTRAINT "cycle_snapshots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committed_packages" ADD CONSTRAINT "committed_packages_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committed_package_items" ADD CONSTRAINT "committed_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_cycle_line_id_fkey" FOREIGN KEY ("cycle_line_id") REFERENCES "cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_definitions" ADD CONSTRAINT "skill_definitions_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("type_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_strategy_runs" ADD CONSTRAINT "trade_strategy_runs_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "trade_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_strategy_run_days" ADD CONSTRAINT "trade_strategy_run_days_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "trade_strategy_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_strategy_run_positions" ADD CONSTRAINT "trade_strategy_run_positions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "trade_strategy_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_strategy_run_positions" ADD CONSTRAINT "trade_strategy_run_positions_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
