-- CreateEnum
CREATE TYPE "public"."CycleStatus" AS ENUM ('PLANNED', 'OPEN', 'COMPLETED');

-- AlterTable
ALTER TABLE "public"."cycles" ADD COLUMN     "status" "public"."CycleStatus" NOT NULL DEFAULT 'PLANNED';
