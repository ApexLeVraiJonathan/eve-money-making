import 'dotenv/config';
import { Prisma, PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

type Args = {
  dryRun: boolean;
  cycleId?: string;
  onlyPlannedOrOpen: boolean;
  sample: number;
};

function parseArgs(argv: string[]): Args {
  const has = (key: string) => argv.includes(`--${key}`);
  const get = (key: string) => {
    const idx = argv.findIndex((a) => a === `--${key}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const sample = Number(get('sample') ?? 10);

  return {
    dryRun: has('dry-run') || has('dryRun'),
    cycleId: get('cycleId'),
    // Default to true (safer): only touch upcoming cycles unless explicitly disabled.
    onlyPlannedOrOpen: !has('all-cycles') && !has('allCycles'),
    sample: Number.isFinite(sample) ? Math.max(0, Math.min(sample, 100)) : 10,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });

  const cycleIdFilter = args.cycleId
    ? Prisma.sql`AND p.cycle_id = ${args.cycleId}`
    : Prisma.empty;
  const cycleStatusFilter = args.onlyPlannedOrOpen
    ? Prisma.sql`AND c.status IN ('PLANNED', 'OPEN')`
    : Prisma.empty;

  const countRows = await prisma.$queryRaw<
    Array<{ count: bigint | number | string }>
  >(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM cycle_participations p
    JOIN cycle_participations src ON src.id = p.rollover_from_participation_id
    JOIN cycles c ON c.id = p.cycle_id
    WHERE p.user_id IS NOT NULL
      AND p.rollover_from_participation_id IS NOT NULL
      AND p.memo LIKE 'ROLLOVER-%'
      AND p.character_name IS DISTINCT FROM src.character_name
      ${cycleIdFilter}
      ${cycleStatusFilter}
  `);

  const count = Number(countRows?.[0]?.count ?? 0);

  // eslint-disable-next-line no-console
  console.log(
    `[repair-rollover-character-names] candidates=${count} ` +
      `(onlyPlannedOrOpen=${args.onlyPlannedOrOpen}, cycleId=${args.cycleId ?? 'any'}, dryRun=${args.dryRun})`,
  );

  if (count === 0) {
    await prisma.$disconnect();
    return;
  }

  if (args.sample > 0) {
    const samples = await prisma.$queryRaw<
      Array<{
        participationId: string;
        cycleId: string;
        oldName: string;
        newName: string;
        memo: string;
      }>
    >(Prisma.sql`
      SELECT
        p.id AS "participationId",
        p.cycle_id AS "cycleId",
        p.character_name AS "oldName",
        src.character_name AS "newName",
        p.memo AS "memo"
      FROM cycle_participations p
      JOIN cycle_participations src ON src.id = p.rollover_from_participation_id
      JOIN cycles c ON c.id = p.cycle_id
      WHERE p.user_id IS NOT NULL
        AND p.rollover_from_participation_id IS NOT NULL
        AND p.memo LIKE 'ROLLOVER-%'
        AND p.character_name IS DISTINCT FROM src.character_name
        ${cycleIdFilter}
        ${cycleStatusFilter}
      ORDER BY p.created_at DESC
      LIMIT ${args.sample}
    `);

    // eslint-disable-next-line no-console
    console.log('[repair-rollover-character-names] sample:');
    for (const s of samples) {
      // eslint-disable-next-line no-console
      console.log(
        `- ${s.participationId.substring(0, 8)} cycle=${s.cycleId.substring(
          0,
          8,
        )} old="${s.oldName}" new="${s.newName}" memo="${s.memo}"`,
      );
    }
  }

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log(
      '[repair-rollover-character-names] dry-run mode: no updates applied',
    );
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE cycle_participations AS p
    SET character_name = src.character_name
    FROM cycle_participations AS src, cycles c
    WHERE p.rollover_from_participation_id = src.id
      AND c.id = p.cycle_id
      AND p.user_id IS NOT NULL
      AND p.rollover_from_participation_id IS NOT NULL
      AND p.memo LIKE 'ROLLOVER-%'
      AND p.character_name IS DISTINCT FROM src.character_name
      ${cycleIdFilter}
      ${cycleStatusFilter}
  `);

  // eslint-disable-next-line no-console
  console.log(
    `[repair-rollover-character-names] updated=${String(updated)} (rows)`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

