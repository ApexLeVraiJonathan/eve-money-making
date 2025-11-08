/*
  Warnings:

  - You are about to alter the column `volume_m3` on the `item_types` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(28,2)`.

*/
-- AlterTable
ALTER TABLE "public"."item_types" ALTER COLUMN "volume_m3" SET DATA TYPE DECIMAL(28,2);
