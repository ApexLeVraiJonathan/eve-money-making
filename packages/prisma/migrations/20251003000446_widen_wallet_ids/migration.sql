/*
  Warnings:

  - The primary key for the `wallet_journal` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wallet_transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "public"."wallet_journal" DROP CONSTRAINT "wallet_journal_pkey",
ALTER COLUMN "journal_id" SET DATA TYPE BIGINT,
ALTER COLUMN "context_id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "wallet_journal_pkey" PRIMARY KEY ("character_id", "journal_id");

-- AlterTable
ALTER TABLE "public"."wallet_transactions" DROP CONSTRAINT "wallet_transactions_pkey",
ALTER COLUMN "transaction_id" SET DATA TYPE BIGINT,
ALTER COLUMN "journal_ref_id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("character_id", "transaction_id");
