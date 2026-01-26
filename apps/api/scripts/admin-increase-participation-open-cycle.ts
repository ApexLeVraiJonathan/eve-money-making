import 'dotenv/config';
import { PrismaClient } from '@eve/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

type Args = {
  dryRun: boolean;
  cycleId?: string;
  cycleName?: string;
  participationId?: string;
  characterName?: string;
  fromAmountIsk?: number;
  newAmountIsk: number;
  createLedgerIfShort: boolean;
  sample: number;
};

function parseIsk(input: string): number {
  const raw = input.trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/[,_\s]/g, '');
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([kKmMbB])?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return NaN;
  const suffix = m[2]?.toLowerCase();
  const mult =
    suffix === 'b' ? 1_000_000_000 : suffix === 'm' ? 1_000_000 : suffix === 'k' ? 1_000 : 1;
  return n * mult;
}

function parseArgs(argv: string[]): Args {
  const has = (key: string) => argv.includes(`--${key}`);
  const get = (key: string) => {
    const idx = argv.findIndex((a) => a === `--${key}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const newAmountStr = get('newAmountIsk') ?? get('newAmount') ?? '3000000000';
  const newAmountIsk = parseIsk(newAmountStr);
  if (!Number.isFinite(newAmountIsk) || newAmountIsk <= 0) {
    throw new Error(`Invalid --newAmountIsk "${newAmountStr}"`);
  }

  const fromAmountStr = get('fromAmountIsk') ?? get('fromAmount');
  const fromAmountIsk = fromAmountStr ? parseIsk(fromAmountStr) : undefined;

  const sample = Number(get('sample') ?? 20);

  return {
    dryRun: has('dry-run') || has('dryRun'),
    cycleId: get('cycleId'),
    cycleName: get('cycleName'),
    participationId: get('participationId'),
    characterName: get('characterName'),
    fromAmountIsk:
      fromAmountIsk != null && Number.isFinite(fromAmountIsk)
        ? fromAmountIsk
        : undefined,
    newAmountIsk,
    createLedgerIfShort: !has('no-ledger') && !has('noLedger'),
    sample: Number.isFinite(sample) ? Math.max(0, Math.min(sample, 200)) : 20,
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

  const fmt = (n: number) => n.toFixed(2);

  let participation:
    | (Awaited<
        ReturnType<typeof prisma.cycleParticipation.findUnique>
      > & { cycle?: { id: string; name: string | null; status: string } })
    | null = null;

  if (args.participationId) {
    participation = await prisma.cycleParticipation.findUnique({
      where: { id: args.participationId },
      include: { cycle: { select: { id: true, name: true, status: true } } },
    });
    if (!participation) throw new Error('Participation not found');
  } else {
    if (!args.characterName) {
      throw new Error('Provide --participationId or --characterName');
    }

    let cycleId = args.cycleId;
    if (!cycleId) {
      if (!args.cycleName) {
        throw new Error('Provide --cycleId or --cycleName (when not using --participationId)');
      }

      const cycles = await prisma.cycle.findMany({
        where: { name: { contains: args.cycleName } },
        select: { id: true, name: true, status: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 5,
      });

      if (cycles.length === 0) {
        throw new Error(`No cycle found with name containing "${args.cycleName}"`);
      }
      if (cycles.length > 1) {
        // eslint-disable-next-line no-console
        console.log('[admin-increase] multiple cycles matched; pass --cycleId:');
        for (const c of cycles) {
          // eslint-disable-next-line no-console
          console.log(
            `- ${c.id} status=${c.status} name="${c.name ?? ''}" startedAt=${c.startedAt.toISOString()}`,
          );
        }
        throw new Error('Ambiguous cycleName');
      }

      cycleId = cycles[0].id;
    }

    const matches = await prisma.cycleParticipation.findMany({
      where: {
        cycleId,
        characterName: args.characterName,
        cycle: { status: 'OPEN' },
        ...(args.fromAmountIsk != null
          ? { amountIsk: fmt(args.fromAmountIsk) }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: args.sample,
      include: { cycle: { select: { id: true, name: true, status: true } } },
    });

    if (matches.length === 0) {
      throw new Error(
        `No OPEN-cycle participation found for "${args.characterName}"` +
          (args.fromAmountIsk != null ? ` with amount=${fmt(args.fromAmountIsk)}` : ''),
      );
    }
    if (matches.length > 1) {
      // eslint-disable-next-line no-console
      console.log('[admin-increase] multiple participations matched; rerun with --participationId:');
      for (const p of matches) {
        // eslint-disable-next-line no-console
        console.log(
          `- ${p.id} userId=${p.userId ?? 'null'} amount=${p.amountIsk} status=${p.status} memo="${p.memo}"`,
        );
      }
      throw new Error('Ambiguous participation match');
    }

    participation = matches[0];
  }

  if (!participation) throw new Error('Internal error: participation not resolved');
  if (!participation.cycle) {
    const loaded = await prisma.cycleParticipation.findUnique({
      where: { id: participation.id },
      include: { cycle: { select: { id: true, name: true, status: true } } },
    });
    if (!loaded) throw new Error('Participation not found (reload)');
    participation = loaded;
  }

  const cycleStatus = (participation as any)?.cycle?.status ?? null;
  if (cycleStatus !== 'OPEN') {
    throw new Error(`Cycle is not OPEN (status=${String(cycleStatus)})`);
  }

  const current = Number(participation.amountIsk);
  if (!Number.isFinite(current)) throw new Error('Current amount is not numeric');
  if (args.newAmountIsk < current) {
    throw new Error(
      `New amount must be >= current amount (current=${fmt(current)} new=${fmt(
        args.newAmountIsk,
      )})`,
    );
  }
  if (args.newAmountIsk === current) {
    // eslint-disable-next-line no-console
    console.log(
      `[admin-increase] no-op: already at newAmount=${fmt(args.newAmountIsk)}`,
    );
    await prisma.$disconnect();
    return;
  }

  const delta = args.newAmountIsk - current;

  // Existing deposits recorded for this participation
  const deposits = await prisma.cycleLedgerEntry.aggregate({
    where: { participationId: participation.id, entryType: 'deposit' },
    _sum: { amount: true },
  });
  const alreadyPaid =
    deposits._sum.amount != null ? Number(deposits._sum.amount) : 0;
  const shortBy = Math.max(0, args.newAmountIsk - alreadyPaid);

  // eslint-disable-next-line no-console
  console.log(
    `[admin-increase] target participation=${participation.id} character="${participation.characterName}" ` +
      `cycle="${(participation as any).cycle?.name ?? (participation as any).cycle?.id ?? participation.cycleId}" ` +
      `current=${fmt(current)} new=${fmt(args.newAmountIsk)} delta=${fmt(delta)} ` +
      `alreadyPaid(deposits)=${fmt(alreadyPaid)} shortBy=${fmt(shortBy)} dryRun=${args.dryRun}`,
  );

  if (args.dryRun) {
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const currentPrincipal = Number(
      participation!.userPrincipalIsk ?? participation!.amountIsk,
    );
    const nextPrincipal = Number.isFinite(currentPrincipal)
      ? currentPrincipal + delta
      : args.newAmountIsk;

    await tx.cycleParticipation.update({
      where: { id: participation!.id },
      data: {
        amountIsk: fmt(args.newAmountIsk),
        userPrincipalIsk: fmt(nextPrincipal),
        // keep OPTED_IN + validatedAt as-is; this is an admin adjustment
      },
    });

    if (args.createLedgerIfShort && shortBy > 0) {
      await tx.cycleLedgerEntry.create({
        data: {
          cycleId: participation!.cycleId,
          entryType: 'deposit',
          amount: fmt(shortBy),
          occurredAt: new Date(),
          memo: `Manual participation top-up ${participation!.characterName}`,
          participationId: participation!.id,
        },
      });
    }
  });

  // eslint-disable-next-line no-console
  console.log('[admin-increase] done');

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

