-- CreateTable
CREATE TABLE "public"."esi_cache_entries" (
    "key" TEXT NOT NULL,
    "etag" TEXT,
    "last_modified" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" INTEGER,
    "body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esi_cache_entries_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "esi_cache_entries_expires_at_idx" ON "public"."esi_cache_entries"("expires_at");
