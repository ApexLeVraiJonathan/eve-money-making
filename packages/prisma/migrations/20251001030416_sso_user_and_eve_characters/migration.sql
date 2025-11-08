-- CreateTable
CREATE TABLE "public"."app_users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."eve_characters" (
    "character_id" INTEGER NOT NULL,
    "character_name" TEXT NOT NULL,
    "owner_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_characters_pkey" PRIMARY KEY ("character_id")
);

-- CreateTable
CREATE TABLE "public"."character_tokens" (
    "id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "token_type" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "public"."app_users"("email");

-- CreateIndex
CREATE INDEX "eve_characters_owner_hash_idx" ON "public"."eve_characters"("owner_hash");

-- CreateIndex
CREATE UNIQUE INDEX "character_tokens_character_id_key" ON "public"."character_tokens"("character_id");

-- AddForeignKey
ALTER TABLE "public"."eve_characters" ADD CONSTRAINT "eve_characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_tokens" ADD CONSTRAINT "character_tokens_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."eve_characters"("character_id") ON DELETE CASCADE ON UPDATE CASCADE;
