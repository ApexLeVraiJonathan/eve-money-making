-- DropForeignKey
ALTER TABLE "public"."cycle_ledger" DROP CONSTRAINT "cycle_ledger_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."plan_commits" DROP CONSTRAINT "plan_commits_cycle_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."plan_commits" ADD CONSTRAINT "plan_commits_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_ledger" ADD CONSTRAINT "cycle_ledger_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
