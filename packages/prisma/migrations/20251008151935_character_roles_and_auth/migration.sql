-- CreateEnum
CREATE TYPE "public"."CharacterRole" AS ENUM ('USER', 'ADMIN', 'LOGISTICS');

-- CreateEnum
CREATE TYPE "public"."CharacterFunction" AS ENUM ('SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "public"."CharacterLocation" AS ENUM ('JITA', 'DODIXIE', 'AMARR', 'HEK', 'RENS', 'CN');

-- AlterTable
ALTER TABLE "public"."eve_characters" ADD COLUMN     "function" "public"."CharacterFunction",
ADD COLUMN     "location" "public"."CharacterLocation",
ADD COLUMN     "role" "public"."CharacterRole" NOT NULL DEFAULT 'USER';
