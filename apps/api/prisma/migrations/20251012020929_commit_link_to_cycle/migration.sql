-- AlterTable
ALTER TABLE "public"."plan_commits" ADD COLUMN     "cycle_id" TEXT;

-- CreateIndex
CREATE INDEX "plan_commits_cycle_id_idx" ON "public"."plan_commits"("cycle_id");

-- AddForeignKey
ALTER TABLE "public"."plan_commits" ADD CONSTRAINT "plan_commits_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
