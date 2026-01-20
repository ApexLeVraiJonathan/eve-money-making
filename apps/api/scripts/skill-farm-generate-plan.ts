import 'dotenv/config';
import { PrismaClient } from '@eve/prisma';
import {
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type SkillPrimaryAttribute,
} from '@eve/shared/skills';

type Args = {
  primary: SkillPrimaryAttribute;
  secondary: SkillPrimaryAttribute;
  planDays: number;
  minSkillDays: number;
  maxPrereqs: number;
  maxSkills: number;
};

function parseArgs(argv: string[]): Args {
  const get = (key: string) => {
    const idx = argv.findIndex((a) => a === `--${key}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const primary = (get('primary') ?? 'intelligence') as SkillPrimaryAttribute;
  const secondary = (get('secondary') ?? 'memory') as SkillPrimaryAttribute;
  const planDays = Number(get('planDays') ?? 90);
  const minSkillDays = Number(get('minSkillDays') ?? 8);
  const maxPrereqs = Number(get('maxPrereqs') ?? 1);
  const maxSkills = Number(get('maxSkills') ?? 12);

  return {
    primary,
    secondary,
    planDays: Number.isFinite(planDays) ? planDays : 90,
    minSkillDays: Number.isFinite(minSkillDays) ? minSkillDays : 8,
    maxPrereqs: Number.isFinite(maxPrereqs) ? maxPrereqs : 1,
    maxSkills: Number.isFinite(maxSkills) ? maxSkills : 12,
  };
}

function buildClassicRemap(
  primary: SkillPrimaryAttribute,
  secondary: SkillPrimaryAttribute,
): AttributeSet {
  const base: AttributeSet = {
    intelligence: 17,
    memory: 17,
    perception: 17,
    willpower: 17,
    charisma: 17,
  };
  base[primary] = 27;
  base[secondary] = 21;
  return base;
}

function countPrereqs(row: {
  prerequisite1Id: number | null;
  prerequisite2Id: number | null;
  prerequisite3Id: number | null;
}) {
  return (
    (row.prerequisite1Id ? 1 : 0) +
    (row.prerequisite2Id ? 1 : 0) +
    (row.prerequisite3Id ? 1 : 0)
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const attrs = buildClassicRemap(args.primary, args.secondary);
  const prisma = new PrismaClient();

  const rows = await prisma.skillDefinition.findMany({
    where: {
      type: { published: true },
      rank: { not: null },
      primaryAttribute: args.primary,
      secondaryAttribute: args.secondary,
    },
    select: {
      typeId: true,
      rank: true,
      prerequisite1Id: true,
      prerequisite1Level: true,
      prerequisite2Id: true,
      prerequisite2Level: true,
      prerequisite3Id: true,
      prerequisite3Level: true,
      type: { select: { name: true } },
    },
  });

  const minSeconds = args.minSkillDays * 24 * 3600;
  const targetSeconds = args.planDays * 24 * 3600;

  const candidates = rows
    .map((r) => {
      const rank = r.rank ?? 1;
      const prereqCount = countPrereqs({
        prerequisite1Id: r.prerequisite1Id ?? null,
        prerequisite2Id: r.prerequisite2Id ?? null,
        prerequisite3Id: r.prerequisite3Id ?? null,
      });
      const seconds = estimateTrainingTimeSeconds({
        currentLevel: 0,
        targetLevel: 5,
        rank,
        attrs,
        primary: args.primary,
        secondary: args.secondary,
      });
      return {
        skillId: r.typeId,
        name: r.type.name,
        rank,
        prereqCount,
        secondsToV: seconds,
        prerequisites: [
          r.prerequisite1Id
            ? { skillId: r.prerequisite1Id, level: r.prerequisite1Level ?? 1 }
            : null,
          r.prerequisite2Id
            ? { skillId: r.prerequisite2Id, level: r.prerequisite2Level ?? 1 }
            : null,
          r.prerequisite3Id
            ? { skillId: r.prerequisite3Id, level: r.prerequisite3Level ?? 1 }
            : null,
        ].filter((x): x is { skillId: number; level: number } => !!x),
      };
    })
    .filter((c) => c.prereqCount <= args.maxPrereqs)
    .filter((c) => c.secondsToV >= minSeconds)
    .sort((a, b) => b.secondsToV - a.secondsToV);

  const picked: typeof candidates = [];
  let total = 0;
  for (const c of candidates) {
    if (picked.length >= args.maxSkills) break;
    picked.push(c);
    total += c.secondsToV;
    if (total >= targetSeconds) break;
  }

  const roman = ['I', 'II', 'III', 'IV', 'V'];
  const planName = `Skill Farm - ${args.primary}/${args.secondary} Crop (${args.planDays}d)`;

  console.log(`[Skill Plan] ${planName}\n`);
  for (const s of picked) console.log(`${s.name} ${roman[4]}`);

  console.log('\n---');
  console.log(`recommended remap: ${JSON.stringify(attrs)}`);
  console.log(
    `total estimated days: ${(total / (24 * 3600)).toFixed(1)} (skills=${picked.length})`,
  );
  console.log(
    `filters: minSkillDays=${args.minSkillDays}, maxPrereqs=${args.maxPrereqs}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

