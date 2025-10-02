-- CreateTable
CREATE TABLE "public"."cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cycle_ledger" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_type" TEXT NOT NULL,
    "amount_isk" DECIMAL(28,2) NOT NULL,
    "memo" TEXT,
    "plan_commit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cycle_ledger_cycle_id_idx" ON "public"."cycle_ledger"("cycle_id");

-- CreateIndex
CREATE INDEX "cycle_ledger_plan_commit_id_idx" ON "public"."cycle_ledger"("plan_commit_id");

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_plan_commit_id_fkey" FOREIGN KEY ("plan_commit_id") REFERENCES "public"."plan_commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
