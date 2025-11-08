-- AlterTable
ALTER TABLE "public"."cycles" ADD COLUMN     "initial_capital_isk" DECIMAL(28,2),
ADD COLUMN     "initial_injection_isk" DECIMAL(28,2);

-- CreateTable
CREATE TABLE "public"."cycle_capital_cache" (
    "cycle_id" TEXT NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_capital_cache_pkey" PRIMARY KEY ("cycle_id")
);

-- AddForeignKey
ALTER TABLE "public"."cycle_capital_cache" ADD CONSTRAINT "cycle_capital_cache_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
