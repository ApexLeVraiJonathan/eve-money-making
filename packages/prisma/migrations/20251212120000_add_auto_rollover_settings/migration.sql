-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."auto_rollover_settings" (
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_rollover_type" "public"."RolloverType" NOT NULL DEFAULT 'INITIAL_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_rollover_settings_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "public"."auto_rollover_settings"
ADD CONSTRAINT "auto_rollover_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;


