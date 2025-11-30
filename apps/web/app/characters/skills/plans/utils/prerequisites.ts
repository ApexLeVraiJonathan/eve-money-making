/**
 * Prerequisite Detection and Enhancement Utilities
 */

import { calculateTrainingTime } from "./trainingTime";

export interface PlanStep {
  id?: string;
  skillId: number;
  targetLevel: number;
  notes?: string;
}

export interface SkillData {
  skillId: number;
  name: string;
  rank?: number;
  trainingMultiplier?: number;
  primaryAttribute?: string;
  secondaryAttribute?: string;
  prerequisites: Array<{
    skillId: number;
    requiredLevel: number;
  }>;
}

export interface SkillEncyclopedia {
  skills: SkillData[];
}

export interface EnhancedPlanStep extends PlanStep {
  skillName: string;
  trainingTimeSeconds: number;
  isPrerequisite: boolean;
  prerequisiteFor: number[];
  hasPrerequisites: boolean;
  prerequisitesExpanded?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  isNew?: boolean;
}

/**
 * Enhance plan steps with prerequisite information and training times
 */
export function enhanceStepsWithPrerequisites(
  steps: PlanStep[],
  encyclopedia: SkillEncyclopedia | undefined | null,
): EnhancedPlanStep[] {
  if (!encyclopedia || !steps.length) {
    return steps.map((step, idx) => ({
      ...step,
      skillName: `Skill ${step.skillId}`,
      trainingTimeSeconds: 0,
      isPrerequisite: false,
      prerequisiteFor: [],
      hasPrerequisites: false,
      prerequisitesExpanded: false,
      canMoveUp: idx > 0,
      canMoveDown: idx < steps.length - 1,
      canRemove: true,
    }));
  }

  const stepMap = new Map<number, EnhancedPlanStep>();
  const prerequisiteMap = new Map<number, Set<number>>();

  // Step 1: Create enhanced steps with basic data
  for (const step of steps) {
    const skillData = encyclopedia.skills.find(
      (s) => s.skillId === step.skillId,
    );
    const rank = skillData?.rank || skillData?.trainingMultiplier || 1;

    stepMap.set(step.skillId, {
      ...step,
      skillName: skillData?.name || `Skill ${step.skillId}`,
      trainingTimeSeconds: calculateTrainingTime(
        rank,
        step.targetLevel,
        20, // default attributes
        20,
      ),
      isPrerequisite: false,
      prerequisiteFor: [],
      hasPrerequisites: (skillData?.prerequisites || []).length > 0,
      prerequisitesExpanded: false,
      canMoveUp: true,
      canMoveDown: true,
      canRemove: true,
    });
  }

  // Step 2: Identify prerequisites
  for (const step of steps) {
    const skillData = encyclopedia.skills.find(
      (s) => s.skillId === step.skillId,
    );
    if (!skillData) continue;

    for (const prereq of skillData.prerequisites) {
      const prereqStep = stepMap.get(prereq.skillId);
      if (prereqStep && prereqStep.targetLevel >= prereq.requiredLevel) {
        // This skill in plan is a prerequisite for current skill
        prereqStep.isPrerequisite = true;
        prereqStep.prerequisiteFor.push(step.skillId);

        if (!prerequisiteMap.has(prereq.skillId)) {
          prerequisiteMap.set(prereq.skillId, new Set());
        }
        prerequisiteMap.get(prereq.skillId)!.add(step.skillId);
      }
    }
  }

  // Step 3: Convert to array and set movement constraints
  const enhancedSteps = Array.from(stepMap.values());

  for (let i = 0; i < enhancedSteps.length; i++) {
    const step = enhancedSteps[i];

    // Can't move up if first item
    step.canMoveUp = i > 0;

    // Can't move down if last item
    step.canMoveDown = i < enhancedSteps.length - 1;

    // Can't remove if it's a prerequisite for skills after it
    if (step.isPrerequisite) {
      const dependentSkills = prerequisiteMap.get(step.skillId);
      if (dependentSkills) {
        // Check if any dependent skills are after this one
        const hasDependentsAfter = enhancedSteps.some(
          (s, idx) => idx > i && dependentSkills.has(s.skillId),
        );
        step.canRemove = !hasDependentsAfter;

        // Can't move down past dependent skills
        if (hasDependentsAfter) {
          step.canMoveDown = false;
        }
      }
    }
  }

  return enhancedSteps;
}
