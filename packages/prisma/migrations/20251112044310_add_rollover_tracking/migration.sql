-- AlterTable
ALTER TABLE "public"."buy_allocations" ADD COLUMN     "is_rollover" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "wallet_character_id" DROP NOT NULL,
ALTER COLUMN "wallet_transaction_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."cycle_lines" ADD COLUMN     "is_rollover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rollover_from_cycle_id" TEXT,
ADD COLUMN     "rollover_from_line_id" TEXT;

-- AlterTable
ALTER TABLE "public"."sell_allocations" ADD COLUMN     "is_rollover" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "wallet_character_id" DROP NOT NULL,
ALTER COLUMN "wallet_transaction_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "cycle_lines_rollover_from_cycle_id_idx" ON "public"."cycle_lines"("rollover_from_cycle_id");
