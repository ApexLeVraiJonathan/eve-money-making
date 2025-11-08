-- CreateTable
CREATE TABLE "public"."oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "user_id" TEXT,
    "return_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "public"."oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_state_idx" ON "public"."oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "public"."oauth_states"("expires_at");
