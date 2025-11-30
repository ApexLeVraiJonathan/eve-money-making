"use client";

import { useMemo } from "react";
import { Button } from "@eve/ui";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedPlanStep, SkillEncyclopedia } from "../utils/prerequisites";
import { romanNumerals } from "../utils/trainingTime";

interface PrerequisiteTreeProps {
  skillId: number;
  encyclopedia: SkillEncyclopedia;
  planSteps: EnhancedPlanStep[];
  onAddPrerequisite?: (skillId: number, level: number) => void;
}

export function PrerequisiteTree({
  skillId,
  encyclopedia,
  planSteps,
  onAddPrerequisite,
}: PrerequisiteTreeProps) {
  const skill = encyclopedia.skills.find((s) => s.skillId === skillId);

  const planSkillIds = useMemo(
    () => new Set(planSteps.map((s) => s.skillId)),
    [planSteps],
  );

  if (!skill || skill.prerequisites.length === 0) return null;

  const renderPrerequisite = (
    prereq: { skillId: number; requiredLevel: number },
    depth: number = 0,
  ) => {
    const prereqSkill = encyclopedia.skills.find(
      (s) => s.skillId === prereq.skillId,
    );
    if (!prereqSkill) return null;

    const isInPlan = planSkillIds.has(prereq.skillId);
    const indent = "  ".repeat(depth);

    return (
      <div key={prereq.skillId} className="text-xs">
        <div className="flex items-center gap-2 py-1">
          <span className="text-muted-foreground font-mono">{indent}├─</span>
          <span
            className={cn(
              isInPlan ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {prereqSkill.name} {romanNumerals[prereq.requiredLevel]}
          </span>
          {isInPlan && <Check className="h-3 w-3 text-primary" />}
          {!isInPlan && onAddPrerequisite && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px]"
              onClick={() =>
                onAddPrerequisite(prereq.skillId, prereq.requiredLevel)
              }
            >
              <Plus className="mr-1 h-2 w-2" />
              Add
            </Button>
          )}
        </div>

        {/* Recursively render sub-prerequisites */}
        {prereqSkill.prerequisites.length > 0 && (
          <div className="ml-2">
            {prereqSkill.prerequisites.map((subPrereq) =>
              renderPrerequisite(subPrereq, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1 rounded-md border-l-2 border-primary/20 bg-muted/20 p-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        Prerequisites for {skill.name}:
      </div>
      {skill.prerequisites.map((prereq) => renderPrerequisite(prereq))}
    </div>
  );
}
