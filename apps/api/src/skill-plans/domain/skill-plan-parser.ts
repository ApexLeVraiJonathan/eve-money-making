import type { PrismaService } from '@api/prisma/prisma.service';
import type {
  SkillPlanDetail,
  SkillPlanImportIssue,
  SkillPlanImportResult,
  SkillPlanStep as SkillPlanStepContract,
} from '@eve/api-contracts';

/**
 * Utility for parsing and normalising skill plan text formats.
 *
 * - EVE format: lines like "Skill Name I" or "Skill Name 1"
 * - App format: JSON header + EVE-style body (to be implemented later)
 */

const ROMAN_TO_LEVEL: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};

type ParsedLine = {
  line: number;
  raw: string;
  skillName: string;
  targetLevel: number;
};

type NormalisedStepInput = {
  skillId: number;
  targetLevel: number;
};

/**
 * Parse a single EVE-format line like "Science I" or "Science 1".
 */
function parseEveLine(
  line: string,
  index: number,
): ParsedLine | SkillPlanImportIssue {
  const raw = line.trim();
  if (!raw) {
    return {
      line: index + 1,
      raw,
      error: 'Empty line',
    };
  }

  // Skip header lines like "[Skill Plan] Name"
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return {
      line: index + 1,
      raw,
      error: 'Header line',
    };
  }

  const parts = raw.split(/\s+/);
  if (parts.length < 2) {
    return {
      line: index + 1,
      raw,
      error: 'Expected "Skill Name Level"',
    };
  }

  const levelToken = parts[parts.length - 1];
  const nameTokens = parts.slice(0, -1);
  const skillName = nameTokens.join(' ');

  let targetLevel: number | undefined;

  const maybeNumber = Number(levelToken);
  if (!Number.isNaN(maybeNumber)) {
    targetLevel = maybeNumber;
  } else {
    const upper = levelToken.toUpperCase();
    targetLevel = ROMAN_TO_LEVEL[upper];
  }

  if (!targetLevel || targetLevel < 1 || targetLevel > 5) {
    return {
      line: index + 1,
      raw,
      error: 'Invalid level (expected 1–5 or I–V)',
    };
  }

  return {
    line: index + 1,
    raw,
    skillName,
    targetLevel,
  };
}

/**
 * Parse EVE-format text into parsed lines and issues.
 */
function parseEveText(text: string): {
  parsed: ParsedLine[];
  issues: SkillPlanImportIssue[];
} {
  const lines = text.split(/\r?\n/);
  const parsed: ParsedLine[] = [];
  const issues: SkillPlanImportIssue[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const result = parseEveLine(trimmed, idx);
    if ('error' in result) {
      // We ignore header lines but keep other issues
      if (result.error !== 'Header line') {
        issues.push(result);
      }
    } else {
      parsed.push(result);
    }
  });

  return { parsed, issues };
}

/**
 * Resolve parsed lines to skill IDs using the SkillDefinition / TypeId tables.
 */
async function resolveSkills(
  prisma: PrismaService,
  parsed: ParsedLine[],
): Promise<{
  steps: NormalisedStepInput[];
  issues: SkillPlanImportIssue[];
}> {
  if (parsed.length === 0) return { steps: [], issues: [] };

  const uniqueNames = Array.from(new Set(parsed.map((p) => p.skillName)));

  const rows = await prisma.typeId.findMany({
    where: { name: { in: uniqueNames } },
    select: { id: true, name: true },
  });

  const byName = new Map<string, number>();
  for (const row of rows) {
    byName.set(row.name, row.id);
  }

  const steps: NormalisedStepInput[] = [];
  const issues: SkillPlanImportIssue[] = [];

  for (const p of parsed) {
    const skillId = byName.get(p.skillName);
    if (!skillId) {
      issues.push({
        line: p.line,
        raw: p.raw,
        error: `Unknown skill name "${p.skillName}" (no matching type in SDE)`,
      });
      continue;
    }

    steps.push({
      skillId,
      targetLevel: p.targetLevel,
    });
  }

  return { steps, issues };
}

/**
 * Expand skill prerequisites so the plan becomes dependency-closed.
 *
 * For each skill, we ensure its prerequisites (and their prerequisites) are
 * present with at least the required level.
 */
async function expandDependencies(
  prisma: PrismaService,
  steps: NormalisedStepInput[],
): Promise<NormalisedStepInput[]> {
  if (steps.length === 0) return [];

  const levelBySkill = new Map<number, number>();
  for (const step of steps) {
    const current = levelBySkill.get(step.skillId) ?? 0;
    levelBySkill.set(step.skillId, Math.max(current, step.targetLevel));
  }

  const queue: number[] = Array.from(levelBySkill.keys());
  const defsById = new Map<
    number,
    {
      prerequisite1Id: number | null;
      prerequisite1Level: number | null;
      prerequisite2Id: number | null;
      prerequisite2Level: number | null;
      prerequisite3Id: number | null;
      prerequisite3Level: number | null;
    }
  >();
  const visited = new Set<number>();

  while (queue.length > 0) {
    const skillId = queue.pop()!;
    if (visited.has(skillId)) continue;
    visited.add(skillId);

    let def = defsById.get(skillId);
    if (!def) {
      const fetched = await prisma.skillDefinition.findUnique({
        where: { typeId: skillId },
        select: {
          prerequisite1Id: true,
          prerequisite1Level: true,
          prerequisite2Id: true,
          prerequisite2Level: true,
          prerequisite3Id: true,
          prerequisite3Level: true,
        },
      });
      if (fetched) {
        defsById.set(skillId, fetched);
        def = fetched;
      } else {
        def = undefined;
      }
    }

    if (!def) continue;

    const prereqs: Array<{ id: number; level: number }> = [];
    if (def.prerequisite1Id && def.prerequisite1Level) {
      prereqs.push({ id: def.prerequisite1Id, level: def.prerequisite1Level });
    }
    if (def.prerequisite2Id && def.prerequisite2Level) {
      prereqs.push({ id: def.prerequisite2Id, level: def.prerequisite2Level });
    }
    if (def.prerequisite3Id && def.prerequisite3Level) {
      prereqs.push({ id: def.prerequisite3Id, level: def.prerequisite3Level });
    }

    for (const prereq of prereqs) {
      const current = levelBySkill.get(prereq.id) ?? 0;
      if (prereq.level > current) {
        levelBySkill.set(prereq.id, prereq.level);
      }
      if (!visited.has(prereq.id)) {
        queue.push(prereq.id);
      }
    }
  }

  // Preserve original order but ensure prerequisites appear before dependants.
  const orderedSkills: number[] = [];
  const seen = new Set<number>();

  function ensureSkillBefore(skillId: number) {
    if (seen.has(skillId)) return;
    seen.add(skillId);

    // Insert prerequisites first
    const def = defsById.get(skillId);
    if (def) {
      const prereqIds = [
        def.prerequisite1Id,
        def.prerequisite2Id,
        def.prerequisite3Id,
      ].filter((id): id is number => typeof id === 'number');
      for (const prereqId of prereqIds) {
        if (levelBySkill.has(prereqId)) {
          ensureSkillBefore(prereqId);
        }
      }
    }

    orderedSkills.push(skillId);
  }

  // Seed with original order
  for (const step of steps) {
    ensureSkillBefore(step.skillId);
  }

  // Add any remaining (pure prerequisite) skills at the end in a stable order
  for (const skillId of levelBySkill.keys()) {
    if (!seen.has(skillId)) {
      orderedSkills.push(skillId);
    }
  }

  return orderedSkills.map((skillId) => ({
    skillId,
    targetLevel: Math.max(1, Math.min(5, levelBySkill.get(skillId) ?? 1)),
  }));
}

/**
 * Build a temporary SkillPlanDetail contract object from normalised steps.
 */
function buildPlanDetail(
  name: string,
  steps: NormalisedStepInput[],
): SkillPlanDetail {
  const nowIso = new Date().toISOString();
  const contractSteps: SkillPlanStepContract[] = steps.map((s, idx) => ({
    id: `temp-${idx}`,
    skillId: s.skillId,
    targetLevel: s.targetLevel,
    order: idx,
    notes: null,
  }));

  return {
    id: 'temp-plan',
    name,
    description: null,
    totalEstimatedTimeSeconds: null,
    tags: null,
    archivedAt: null,
    stepsCount: contractSteps.length,
    createdAt: nowIso,
    updatedAt: nowIso,
    steps: contractSteps,
  };
}

export async function previewImportEveFormat(
  prisma: PrismaService,
  text: string,
  nameHint?: string,
): Promise<SkillPlanImportResult> {
  const { parsed, issues: parsingIssues } = parseEveText(text);
  const { steps: resolvedSteps, issues: resolutionIssues } =
    await resolveSkills(prisma, parsed);

  const expandedSteps = await expandDependencies(prisma, resolvedSteps);

  const name =
    nameHint?.trim() ||
    text
      .split(/\r?\n/)[0]
      ?.replace(/^\[Skill Plan\]\s*/i, '')
      .trim() ||
    'Imported Plan';

  const plan = buildPlanDetail(name, expandedSteps);

  return {
    plan,
    issues: [...parsingIssues, ...resolutionIssues],
  };
}
