"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useSkillPlan, useSkillPlans } from "../../api";
import { SkillPlanDetailView } from "./sections/skill-plan-detail-view";
import { SkillPlanList } from "./sections/skill-plan-list";

export default function SkillPlansPageClient() {
  const { data: plans = [], isLoading } = useSkillPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = useSkillPlan(selectedPlanId);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Skill Plans</h1>
            <p className="text-xs text-muted-foreground">
              Create reusable training plans and assign them to your characters.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] flex-1 min-h-0">
        <div className="col-span-1 flex flex-col min-h-0">
          <SkillPlanList
            loading={isLoading}
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
          />
        </div>
        <div className="col-span-1 flex flex-col min-h-0">
          <SkillPlanDetailView planId={selectedPlanId} planQuery={selectedPlan} />
        </div>
      </div>
    </div>
  );
}
