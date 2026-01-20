const path = require("path");
const dotenv = require("dotenv");

// Prefer repo-root .env (../../.env from apps/api/scripts). Fall back to apps/api/.env.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { PrismaClient } = require("@eve/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

/**
 * Canonical EVE training formula:
 * SP/hour = 60 * primary + 30 * secondary
 */
function spPerHour(attrs, primary, secondary) {
  return 60 * attrs[primary] + 30 * attrs[secondary];
}

/**
 * SP required for a single level for a given rank:
 * SP(level) = 250 * rank * 2^(2*level - 2), where level is 1..5
 */
function spForLevel(level, rank) {
  const clamped = Math.min(Math.max(level, 1), 5);
  return 250 * rank * Math.pow(2, 2 * clamped - 2);
}

function totalSpForLevels(fromLevel, toLevel, rank) {
  const start = Math.max(0, fromLevel);
  const end = Math.min(5, toLevel);
  if (end <= start) return 0;
  let total = 0;
  for (let lvl = start + 1; lvl <= end; lvl++) total += spForLevel(lvl, rank);
  return total;
}

function estimateTrainingTimeSeconds({
  currentLevel,
  targetLevel,
  rank,
  attrs,
  primary,
  secondary,
}) {
  if (targetLevel <= currentLevel) return 0;
  const remainingSp = totalSpForLevels(currentLevel, targetLevel, rank);
  const rate = spPerHour(attrs, primary, secondary);
  if (rate <= 0) return 0;
  const hours = remainingSp / rate;
  return Math.round(hours * 3600);
}

function getArg(key) {
  const idx = process.argv.findIndex((a) => a === `--${key}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function buildClassicRemap(primary, secondary) {
  const base = {
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

function countPrereqs(r) {
  return (r.prerequisite1Id ? 1 : 0) + (r.prerequisite2Id ? 1 : 0) + (r.prerequisite3Id ? 1 : 0);
}

async function main() {
  const primary = getArg("primary") || "intelligence";
  const secondary = getArg("secondary") || "memory";
  const planDays = Number(getArg("planDays") || 90);
  const minSkillDays = Number(getArg("minSkillDays") || 8);
  const maxPrereqs = Number(getArg("maxPrereqs") || 1);
  const maxSkills = Number(getArg("maxSkills") || 12);

  const attrs = buildClassicRemap(primary, secondary);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const rows = await prisma.skillDefinition.findMany({
    where: {
      type: { published: true },
      rank: { not: null },
      primaryAttribute: primary,
      secondaryAttribute: secondary,
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

  const minSeconds = minSkillDays * 24 * 3600;
  const targetSeconds = planDays * 24 * 3600;

  const candidates = rows
    .map((r) => {
      const rank = r.rank || 1;
      const prereqCount = countPrereqs({
        prerequisite1Id: r.prerequisite1Id ?? null,
        prerequisite2Id: r.prerequisite2Id ?? null,
        prerequisite3Id: r.prerequisite3Id ?? null,
      });
      const secondsToV = estimateTrainingTimeSeconds({
        currentLevel: 0,
        targetLevel: 5,
        rank,
        attrs,
        primary,
        secondary,
      });
      return {
        skillId: r.typeId,
        name: r.type.name,
        rank,
        prereqCount,
        secondsToV,
      };
    })
    .filter((c) => c.prereqCount <= maxPrereqs)
    .filter((c) => c.secondsToV >= minSeconds)
    .sort((a, b) => b.secondsToV - a.secondsToV);

  const picked = [];
  let total = 0;
  for (const c of candidates) {
    if (picked.length >= maxSkills) break;
    picked.push(c);
    total += c.secondsToV;
    if (total >= targetSeconds) break;
  }

  const roman = ["I", "II", "III", "IV", "V"];
  const planName = `Skill Farm - ${primary}/${secondary} Crop (${planDays}d)`;

  console.log(`[Skill Plan] ${planName}\n`);
  for (const s of picked) console.log(`${s.name} ${roman[4]}`);

  console.log("\n---");
  console.log(`recommended remap: ${JSON.stringify(attrs)}`);
  console.log(`total estimated days: ${(total / (24 * 3600)).toFixed(1)} (skills=${picked.length})`);
  console.log(`filters: minSkillDays=${minSkillDays}, maxPrereqs=${maxPrereqs}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

