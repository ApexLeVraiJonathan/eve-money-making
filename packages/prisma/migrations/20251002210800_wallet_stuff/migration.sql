/*
  Warnings:

  - A unique constraint covering the columns `[source,source_id]` on the table `cycle_ledger` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."cycle_ledger" ADD COLUMN     "character_id" INTEGER,
ADD COLUMN     "match_status" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "station_id" INTEGER,
ADD COLUMN     "type_id" INTEGER;

-- CreateTable
CREATE TABLE "public"."wallet_transactions" (
    "character_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "is_buy" BOOLEAN NOT NULL,
    "location_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(28,2) NOT NULL,
    "journal_ref_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("character_id","transaction_id")
);

-- CreateTable
CREATE TABLE "public"."wallet_journal" (
    "character_id" INTEGER NOT NULL,
    "journal_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ref_type" TEXT NOT NULL,
    "amount" DECIMAL(28,2) NOT NULL,
    "balance" DECIMAL(28,2),
    "context_id" INTEGER,
    "context_id_type" TEXT,
    "description" TEXT,
    "first_party_id" INTEGER,
    "second_party_id" INTEGER,
    "tax" DECIMAL(28,2),
    "tax_receiver_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_journal_pkey" PRIMARY KEY ("character_id","journal_id")
);

-- CreateTable
CREATE TABLE "public"."plan_commit_lines" (
    "id" TEXT NOT NULL,
    "commit_id" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "source_station_id" INTEGER NOT NULL,
    "destination_station_id" INTEGER NOT NULL,
    "planned_units" INTEGER NOT NULL,
    "unit_cost" DECIMAL(28,2) NOT NULL,
    "unit_profit" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_commit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_transactions_character_id_idx" ON "public"."wallet_transactions"("character_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_date_idx" ON "public"."wallet_transactions"("date");

-- CreateIndex
CREATE INDEX "wallet_journal_character_id_idx" ON "public"."wallet_journal"("character_id");

-- CreateIndex
CREATE INDEX "wallet_journal_date_idx" ON "public"."wallet_journal"("date");

-- CreateIndex
CREATE INDEX "plan_commit_lines_commit_id_idx" ON "public"."plan_commit_lines"("commit_id");

-- CreateIndex
CREATE INDEX "plan_commit_lines_type_id_destination_station_id_idx" ON "public"."plan_commit_lines"("type_id", "destination_station_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_character_id_idx" ON "public"."cycle_ledger"("character_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_station_id_idx" ON "public"."cycle_ledger"("station_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_type_id_idx" ON "public"."cycle_ledger"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_ledger_source_source_id_key" ON "public"."cycle_ledger"("source", "source_id");

-- AddForeignKey
ALTER TABLE "public"."plan_commit_lines" ADD CONSTRAINT "plan_commit_lines_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "public"."plan_commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
