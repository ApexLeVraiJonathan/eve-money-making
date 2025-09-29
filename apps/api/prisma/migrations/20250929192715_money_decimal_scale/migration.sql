/*
  Warnings:

  - You are about to alter the column `high` on the `market_order_trades_daily` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(28,2)`.
  - You are about to alter the column `low` on the `market_order_trades_daily` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(28,2)`.
  - You are about to alter the column `avg` on the `market_order_trades_daily` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(28,2)`.
  - You are about to alter the column `isk_value` on the `market_order_trades_daily` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(28,2)`.

*/
-- AlterTable
ALTER TABLE "public"."market_order_trades_daily" ALTER COLUMN "high" SET DATA TYPE DECIMAL(28,2),
ALTER COLUMN "low" SET DATA TYPE DECIMAL(28,2),
ALTER COLUMN "avg" SET DATA TYPE DECIMAL(28,2),
ALTER COLUMN "isk_value" SET DATA TYPE DECIMAL(28,2);
