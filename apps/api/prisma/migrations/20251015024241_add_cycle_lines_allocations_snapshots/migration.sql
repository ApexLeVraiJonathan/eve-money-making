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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buy_allocations" (
    "id" TEXT NOT NULL,
    "wallet_character_id" INTEGER NOT NULL,
    "wallet_transaction_id" BIGINT NOT NULL,
    "line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buy_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sell_allocations" (
    "id" TEXT NOT NULL,
    "wallet_character_id" INTEGER NOT NULL,
    "wallet_transaction_id" BIGINT NOT NULL,
    "line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "revenue_isk" DECIMAL(28,2) NOT NULL,
    "tax_isk" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_idx" ON "public"."cycle_lines"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_lines_type_id_idx" ON "public"."cycle_lines"("type_id");

-- CreateIndex
CREATE INDEX "cycle_lines_destination_station_id_idx" ON "public"."cycle_lines"("destination_station_id");

-- CreateIndex
CREATE INDEX "cycle_lines_cycle_id_type_id_idx" ON "public"."cycle_lines"("cycle_id", "type_id");

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

-- RenameIndex
ALTER INDEX "public"."cycle_user_unique" RENAME TO "cycle_participations_cycle_id_user_id_key";
