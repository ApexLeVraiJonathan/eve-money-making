"use client";

import { Badge } from "@eve/ui/badge";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { SkillFarmMathWorkspace } from "./skill-farm-math-workspace";

export default function SkillFarmMathPageClient() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <DynamicBreadcrumbs />
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Skill farm math &amp; planner
          </h1>
          <Badge variant="secondary" className="text-xs">
            Step 3 of 3
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-foreground/80">
          Configure your prices and farm layout to estimate profit, and see a
          detailed breakdown that makes it easy to sanity-check assumptions.
        </p>
      </header>
      <SkillFarmMathWorkspace />
    </div>
  );
}
