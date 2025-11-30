export type SkillPrimaryAttribute =
  | "intelligence"
  | "memory"
  | "perception"
  | "willpower"
  | "charisma";

export type AttributeSet = {
  intelligence: number;
  memory: number;
  perception: number;
  willpower: number;
  charisma: number;
};

/**
 * SP/hour for a given skill under a given attribute set, using the canonical
 * EVE formula: SP/hour = 60 * primary + 30 * secondary.
 */
export function spPerHour(
  attrs: AttributeSet,
  primary: SkillPrimaryAttribute,
  secondary: SkillPrimaryAttribute
): number {
  const p = attrs[primary];
  const s = attrs[secondary];
  return 60 * p + 30 * s;
}

/**
 * Approximate SP required to train a single level for a given rank.
 *
 * This uses the standard EVE approximation:
 *   SP(level) ≈ 250 * rank * 2^(2 * level - 2)
 *
 * where `level` is 1–5.
 */
export function spForLevel(level: number, rank: number): number {
  if (level < 1) return 0;
  const clampedLevel = Math.min(Math.max(level, 1), 5);
  return 250 * rank * Math.pow(2, 2 * clampedLevel - 2);
}

/**
 * Total SP required to go from `fromLevel` (inclusive) to `toLevel` (exclusive).
 *
 * Example: fromLevel=0, toLevel=3 → SP for levels 1,2,3.
 */
export function totalSpForLevels(
  fromLevel: number,
  toLevel: number,
  rank: number
): number {
  const start = Math.max(0, fromLevel);
  const end = Math.min(5, toLevel);
  if (end <= start) return 0;

  let total = 0;
  for (let lvl = start + 1; lvl <= end; lvl++) {
    total += spForLevel(lvl, rank);
  }
  return total;
}

/**
 * Estimate training time (in seconds) to go from currentLevel → targetLevel.
 *
 * - `currentLevel` and `targetLevel` are in [0, 5].
 * - `rank` is the skill rank (1,2,3,...).
 * - `attrs` are the character attributes.
 */
export function estimateTrainingTimeSeconds(options: {
  currentLevel: number;
  targetLevel: number;
  rank: number;
  attrs: AttributeSet;
  primary: SkillPrimaryAttribute;
  secondary: SkillPrimaryAttribute;
}): number {
  const { currentLevel, targetLevel, rank, attrs, primary, secondary } =
    options;
  if (targetLevel <= currentLevel) return 0;
  const remainingSp = totalSpForLevels(currentLevel, targetLevel, rank);
  const ratePerHour = spPerHour(attrs, primary, secondary);
  if (ratePerHour <= 0) return 0;
  const hours = remainingSp / ratePerHour;
  return Math.round(hours * 3600);
}

export interface PlanStepForOptimization {
  /** EVE typeId / skillId */
  skillId: number;
  /** Rank of the skill (1,2,3,...) */
  rank: number;
  /** Current trained level (0–5) */
  currentLevel: number;
  /** Target level (1–5, >= currentLevel) */
  targetLevel: number;
  /** Primary attribute for this skill */
  primaryAttribute: SkillPrimaryAttribute;
  /** Secondary attribute for this skill */
  secondaryAttribute: SkillPrimaryAttribute;
}

export interface AttributeSuggestionResult {
  recommended: AttributeSet;
  reasoning: string;
}

/**
 * Compute a simple weight per attribute for a given set of planned skills.
 *
 * This is used by the optimizer; exposed for diagnostics.
 */
export function computeAttributeWeightsForPlan(
  steps: PlanStepForOptimization[]
): Record<SkillPrimaryAttribute, number> {
  const weights: Record<SkillPrimaryAttribute, number> = {
    intelligence: 0,
    memory: 0,
    perception: 0,
    willpower: 0,
    charisma: 0,
  };

  for (const step of steps) {
    if (step.targetLevel <= step.currentLevel) continue;
    const spNeeded = totalSpForLevels(
      step.currentLevel,
      step.targetLevel,
      step.rank
    );

    if (spNeeded <= 0) continue;

    // Weight primary twice as much as secondary by default
    weights[step.primaryAttribute] += spNeeded;
    weights[step.secondaryAttribute] += spNeeded * 0.5;
  }

  return weights;
}

/**
 * Recommend a single-remap attribute distribution for a plan, using a simple
 * heuristic that matches typical EVE remap constraints:
 *
 * - Start from 17 in all attributes.
 * - Distribute 14 extra points across the most important attributes
 *   (10 to the highest-weight, 4 to the second-highest), yielding
 *   the classic 27/21/17/17/17 pattern.
 *
 * This is deliberately simple but provides a strong signal for which
 * attributes to emphasize.
 */
export function suggestAttributesForPlan(
  steps: PlanStepForOptimization[],
  opts?: {
    baseAttributes?: AttributeSet;
    extraPoints?: number;
  }
): AttributeSuggestionResult {
  const base: AttributeSet =
    opts?.baseAttributes ??
    ({
      intelligence: 17,
      memory: 17,
      perception: 17,
      willpower: 17,
      charisma: 17,
    } satisfies AttributeSet);

  const extraTotal = opts?.extraPoints ?? 14;
  const weights = computeAttributeWeightsForPlan(steps);

  const entries = Object.entries(weights) as [SkillPrimaryAttribute, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const recommended: AttributeSet = { ...base };
  let remaining = extraTotal;

  if (entries.length > 0 && remaining > 0) {
    const top = entries[0][0];
    const topAdd = Math.min(10, remaining);
    recommended[top] += topAdd;
    remaining -= topAdd;
  }

  if (entries.length > 1 && remaining > 0) {
    const second = entries[1][0];
    const secondAdd = Math.min(remaining, 4);
    recommended[second] += secondAdd;
    remaining -= secondAdd;
  }

  const reasoningParts: string[] = [];
  if (entries.length > 0 && entries[0][1] > 0) {
    reasoningParts.push(
      `Primary focus on ${entries[0][0]} (most skills in the plan use it as primary or secondary).`
    );
  }
  if (entries.length > 1 && entries[1][1] > 0) {
    reasoningParts.push(
      `Secondary focus on ${entries[1][0]} (second-highest contribution).`
    );
  }

  if (reasoningParts.length === 0) {
    reasoningParts.push(
      "No attribute-heavy skills detected in the plan; using a balanced remap."
    );
  }

  return {
    recommended,
    reasoning: reasoningParts.join(" "),
  };
}
