-- CreateTable
CREATE TABLE "script_confirm_batches" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_confirm_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "script_confirm_batches_idempotency_key_key" ON "script_confirm_batches"("idempotency_key");

-- CreateIndex
CREATE INDEX "script_confirm_batches_created_at_idx" ON "script_confirm_batches"("created_at");
