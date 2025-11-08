-- CreateEnum
CREATE TYPE "public"."CharacterManagedBy" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "public"."character_tokens" ADD COLUMN     "last_refresh_at" TIMESTAMP(3),
ADD COLUMN     "refresh_fail_at" TIMESTAMP(3),
ADD COLUMN     "refresh_fail_msg" TEXT;

-- AlterTable
ALTER TABLE "public"."eve_characters" ADD COLUMN     "managed_by" "public"."CharacterManagedBy" NOT NULL DEFAULT 'USER',
ADD COLUMN     "notes" TEXT;
