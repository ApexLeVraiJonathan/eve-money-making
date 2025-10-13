/*
  Warnings:

  - A unique constraint covering the columns `[primary_character_id]` on the table `app_users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."app_users" ADD COLUMN     "primary_character_id" INTEGER,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE UNIQUE INDEX "app_users_primary_character_id_key" ON "public"."app_users"("primary_character_id");

-- CreateIndex
CREATE INDEX "eve_characters_user_id_idx" ON "public"."eve_characters"("user_id");

-- AddForeignKey
ALTER TABLE "public"."app_users" ADD CONSTRAINT "app_users_primary_character_id_fkey" FOREIGN KEY ("primary_character_id") REFERENCES "public"."eve_characters"("character_id") ON DELETE SET NULL ON UPDATE CASCADE;
