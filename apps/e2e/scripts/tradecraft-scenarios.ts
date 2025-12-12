import { createPrisma, ensureE2eAdmin, resetTradecraftData } from "../testkit/db";

type ScenarioName =
  | "cycles:empty"
  | "cycles:planned"
  | "cycles:planned-opted-in"
  | "cycles:open"
  | "cycles:open-opted-in"
  | "cycles:open+planned"
  | "cycles:rollover-into-planned"
  | "cycles:auto-rollover-on";

const ALL_SCENARIOS: ScenarioName[] = [
  "cycles:empty",
  "cycles:planned",
  "cycles:planned-opted-in",
  "cycles:open",
  "cycles:open-opted-in",
  "cycles:open+planned",
  "cycles:rollover-into-planned",
  "cycles:auto-rollover-on",
];

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      "Usage:",
      "  pnpm -C apps/e2e seed:tradecraft <scenario>",
      "",
      "Examples:",
      "  pnpm -C apps/e2e seed:tradecraft cycles:planned",
      "  pnpm -C apps/e2e seed:tradecraft cycles:open+planned",
      "  pnpm -C apps/e2e seed:tradecraft cycles:rollover-into-planned",
      "",
      "List:",
      "  pnpm -C apps/e2e seed:tradecraft:list",
    ].join("\n"),
  );
}

function parseScenario(argv: string[]): ScenarioName | null {
  const arg = argv.find((a) => !a.startsWith("-"));
  if (!arg) return null;
  if ((ALL_SCENARIOS as readonly string[]).includes(arg)) return arg as ScenarioName;
  return null;
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(0);
  }
  if (args.includes("--list")) {
    // eslint-disable-next-line no-console
    console.log(ALL_SCENARIOS.join("\n"));
    process.exit(0);
  }

  const scenario = parseScenario(args);
  if (!scenario) {
    // eslint-disable-next-line no-console
    console.error("Missing or unknown scenario.\n");
    usage();
    process.exit(1);
  }

  const prisma = createPrisma();
  try {
    const userId = await ensureE2eAdmin(prisma);
    await resetTradecraftData(prisma);

    const baseUrl = process.env.WEB_URL ?? "http://localhost:3001";

    if (scenario === "cycles:empty") {
      // nothing else to do
    }

    if (scenario === "cycles:planned" || scenario === "cycles:planned-opted-in") {
      const planned = await prisma.cycle.create({
        data: {
          name: "Seeded Planned Cycle",
          status: "PLANNED",
          startedAt: isoDaysFromNow(7),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      if (scenario === "cycles:planned-opted-in") {
        await prisma.cycleParticipation.create({
          data: {
            cycleId: planned.id,
            userId,
            characterName: "E2E Admin",
            amountIsk: "1000000000.00",
            memo: `SEED-${planned.id.substring(0, 8)}-${userId.substring(0, 8)}`,
            status: "OPTED_IN",
            validatedAt: new Date(),
          },
        });
      }
    }

    if (scenario === "cycles:open" || scenario === "cycles:open-opted-in") {
      const open = await prisma.cycle.create({
        data: {
          name: "Seeded Open Cycle",
          status: "OPEN",
          startedAt: isoDaysFromNow(-3),
          initialCapitalIsk: "2000000000.00",
        },
        select: { id: true },
      });

      if (scenario === "cycles:open-opted-in") {
        await prisma.cycleParticipation.create({
          data: {
            cycleId: open.id,
            userId,
            characterName: "E2E Admin",
            amountIsk: "1500000000.00",
            memo: `SEED-${open.id.substring(0, 8)}-${userId.substring(0, 8)}`,
            status: "OPTED_IN",
            validatedAt: new Date(),
          },
        });
      }
    }

    if (scenario === "cycles:open+planned") {
      const open = await prisma.cycle.create({
        data: {
          name: "Seeded Open Cycle",
          status: "OPEN",
          startedAt: isoDaysFromNow(-3),
          initialCapitalIsk: "2000000000.00",
        },
        select: { id: true },
      });
      await prisma.cycle.create({
        data: {
          name: "Seeded Planned Cycle",
          status: "PLANNED",
          startedAt: isoDaysFromNow(7),
          initialCapitalIsk: "2500000000.00",
        },
        select: { id: true },
      });
      // give the user an active participation in the open cycle
      await prisma.cycleParticipation.create({
        data: {
          cycleId: open.id,
          userId,
          characterName: "E2E Admin",
          amountIsk: "1500000000.00",
          memo: `SEED-${open.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
      });
    }

    if (scenario === "cycles:rollover-into-planned") {
      // A previous completed participation to roll from
      const completed = await prisma.cycle.create({
        data: {
          name: "Seeded Completed Cycle",
          status: "COMPLETED",
          startedAt: isoDaysFromNow(-20),
          closedAt: isoDaysFromNow(-10),
          initialCapitalIsk: "2000000000.00",
        },
        select: { id: true },
      });

      const fromParticipation = await prisma.cycleParticipation.create({
        data: {
          cycleId: completed.id,
          userId,
          characterName: "E2E Admin",
          amountIsk: "1000000000.00",
          memo: `SEED-${completed.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "COMPLETED",
          validatedAt: new Date(),
          payoutAmountIsk: "1200000000.00",
          payoutPaidAt: new Date(),
        },
        select: { id: true },
      });

      // Next planned cycle with a rollover preference set (as if the user selected it)
      const planned = await prisma.cycle.create({
        data: {
          name: "Seeded Planned Cycle (rollover)",
          status: "PLANNED",
          startedAt: isoDaysFromNow(7),
          initialCapitalIsk: "2500000000.00",
        },
        select: { id: true },
      });

      await prisma.cycleParticipation.create({
        data: {
          cycleId: planned.id,
          userId,
          characterName: "E2E Admin",
          amountIsk: "1.00",
          memo: `ROLLOVER-SEED-${planned.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "INITIAL_ONLY",
          rolloverFromParticipationId: fromParticipation.id,
        },
      });
    }

    if (scenario === "cycles:auto-rollover-on") {
      // Make sure there is at least a planned cycle to observe the UI.
      const planned = await prisma.cycle.create({
        data: {
          name: "Seeded Planned Cycle (auto-rollover on)",
          status: "PLANNED",
          startedAt: isoDaysFromNow(7),
          initialCapitalIsk: "2500000000.00",
        },
        select: { id: true },
      });

      await prisma.autoRolloverSettings.upsert({
        where: { userId },
        update: { enabled: true, defaultRolloverType: "INITIAL_ONLY" },
        create: { userId, enabled: true, defaultRolloverType: "INITIAL_ONLY" },
      });

      // Make the user visible on the page as well.
      await prisma.cycleParticipation.create({
        data: {
          cycleId: planned.id,
          userId,
          characterName: "E2E Admin",
          amountIsk: "1.00",
          memo: `SEED-${planned.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "INITIAL_ONLY",
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`Seeded scenario: ${scenario}`);
    // eslint-disable-next-line no-console
    console.log(`Open: ${baseUrl}/tradecraft/cycles`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(String(err));
  process.exit(1);
});


