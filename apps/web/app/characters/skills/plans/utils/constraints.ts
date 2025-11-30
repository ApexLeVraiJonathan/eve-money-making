/**
 * Movement Constraint Validation
 */

import { EnhancedPlanStep, SkillEncyclopedia } from "./prerequisites";

export interface CanMoveResult {
  canMove: boolean;
  reason?: string;
}

/**
 * Check if a step can be moved to a new position
 */
export function canMoveStep(
  steps: EnhancedPlanStep[],
  fromIndex: number,
  toIndex: number,
  encyclopedia: SkillEncyclopedia | undefined | null,
): CanMoveResult {
  if (toIndex < 0 || toIndex >= steps.length) {
    return { canMove: false, reason: "Invalid position" };
  }

  if (!encyclopedia) {
    return { canMove: true };
  }

  const step = steps[fromIndex];
  const skillData = encyclopedia.skills.find((s) => s.skillId === step.skillId);
  if (!skillData) return { canMove: true };

  // Check if moving would place skill before its prerequisites
  for (const prereq of skillData.prerequisites) {
    const prereqIndex = steps.findIndex(
      (s) =>
        s.skillId === prereq.skillId && s.targetLevel >= prereq.requiredLevel,
    );

    if (prereqIndex !== -1 && toIndex < prereqIndex) {
      const prereqName = steps[prereqIndex].skillName;
      return {
        canMove: false,
        reason: `Must train ${prereqName} first (prerequisite)`,
      };
    }
  }

  // Check if this skill is a prerequisite for skills that would come before it
  if (step.isPrerequisite) {
    for (const dependentSkillId of step.prerequisiteFor) {
      const dependentIndex = steps.findIndex(
        (s) => s.skillId === dependentSkillId,
      );
      if (dependentIndex !== -1 && toIndex > dependentIndex) {
        const dependentName = steps[dependentIndex].skillName;
        return {
          canMove: false,
          reason: `Required before ${dependentName}`,
        };
      }
    }
  }

  return { canMove: true };
}
