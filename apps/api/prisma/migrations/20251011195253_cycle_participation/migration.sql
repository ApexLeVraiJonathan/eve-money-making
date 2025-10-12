-- CreateEnum
CREATE TYPE "public"."ParticipationStatus" AS ENUM ('AWAITING_INVESTMENT', 'AWAITING_VALIDATION', 'OPTED_IN', 'OPTED_OUT', 'COMPLETED', 'REFUNDED');

-- AlterTable
ALTER TABLE "public"."cycle_ledger" ADD COLUMN     "participation_id" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "cycle_participations_memo_key" ON "public"."cycle_participations"("memo");

-- CreateIndex
CREATE INDEX "cycle_participations_cycle_id_idx" ON "public"."cycle_participations"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_participation_id_idx" ON "public"."cycle_ledger"("participation_id");

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "public"."cycle_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_participations" ADD CONSTRAINT "cycle_participations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
