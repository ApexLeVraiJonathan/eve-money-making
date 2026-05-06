import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma } from "../../../../testkit/db";
import {
  seedTradecraftAcceptance,
  TRADECRAFT_ACCEPTANCE_SEED,
} from "../../../../testkit/tradecraft-acceptance-seed";

type JingleYieldCreateResponse = {
  participation: {
    id: string;
    cycleId: string;
    userId: string;
    amountIsk: string;
    userPrincipalIsk: string | null;
    status: string;
    jingleYieldProgramId: string | null;
  };
  program: {
    id: string;
    userId: string;
    rootParticipationId: string;
    status: string;
    lockedPrincipalIsk: string;
    targetInterestIsk: string;
    startCycleId: string;
    minCycles: number;
  };
};

type JingleYieldProgramSummary = {
  id: string;
  userId: string;
  status: string;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  cyclesCompleted: number;
  minCycles: number;
  startCycle?: { id: string; name: string | null } | null;
  completedCycle?: { id: string; name: string | null } | null;
};

type CycleParticipationResponse = {
  id: string;
  cycleId: string;
  userId: string | null;
  amountIsk: string;
  userPrincipalIsk: string | null;
  status: string;
  rolloverType: string | null;
  rolloverFromParticipationId: string | null;
  jingleYieldProgramId: string | null;
};

type TradecraftCapsResponse = {
  principalCapIsk: string;
  effectivePrincipalCapIsk: string;
  maximumCapIsk: string;
};

async function openPlannedCycleWithStableRolloverCaps(
  api: ReturnType<typeof createApiCall>,
  plannedCycleId: string,
) {
  await Promise.all([
    api(
      "PATCH",
      `/admin/users/${TRADECRAFT_ACCEPTANCE_SEED.users.fullPayout.id}/tradecraft-caps`,
      {
        principalCapIsk: "20000000000.00",
        maximumCapIsk: "20000000000.00",
      },
    ),
    api(
      "PATCH",
      `/admin/users/${TRADECRAFT_ACCEPTANCE_SEED.users.customRollover.id}/tradecraft-caps`,
      {
        principalCapIsk: "20000000000.00",
        maximumCapIsk: "20000000000.00",
      },
    ),
  ]);

  await api("POST", `/ledger/cycles/${plannedCycleId}/open`, {});
}

test.describe("Tradecraft JingleYield Program acceptance", () => {
  test("allows admins to create a first-class JingleYield Program and exposes its cap effect", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);
      const user = TRADECRAFT_ACCEPTANCE_SEED.users.refund;

      const created = await api<JingleYieldCreateResponse>(
        "POST",
        "/ledger/jingle-yield/participations",
        {
          userId: user.id,
          cycleId: seeded.cycles.plannedCycleId,
          adminCharacterId: seeded.logisticsCharacterId,
          characterName: user.characterName,
          principalIsk: "1500000000.00",
          minCycles: 3,
        },
      );

      expect(created.participation).toEqual(
        expect.objectContaining({
          cycleId: seeded.cycles.plannedCycleId,
          userId: user.id,
          status: "AWAITING_INVESTMENT",
          userPrincipalIsk: "0",
        }),
      );
      expect(Number(created.participation.amountIsk)).toBe(1_500_000_000);
      expect(created.program).toEqual(
        expect.objectContaining({
          userId: user.id,
          rootParticipationId: created.participation.id,
          status: "ACTIVE",
          startCycleId: seeded.cycles.plannedCycleId,
          minCycles: 3,
        }),
      );
      expect(Number(created.program.lockedPrincipalIsk)).toBe(1_500_000_000);

      const programs = await api<JingleYieldProgramSummary[]>(
        "GET",
        "/ledger/jingle-yield/programs",
      );
      expect(programs).toContainEqual(
        expect.objectContaining({
          id: created.program.id,
          userId: user.id,
          status: "ACTIVE",
          cyclesCompleted: 0,
          minCycles: 3,
        }),
      );

      const caps = await api<TradecraftCapsResponse>(
        "GET",
        `/ledger/participations/admin/caps?userId=${user.id}`,
      );
      expect(Number(caps.principalCapIsk)).toBe(10_000_000_000);
      expect(Number(caps.effectivePrincipalCapIsk)).toBe(8_500_000_000);
      expect(Number(caps.maximumCapIsk)).toBe(20_000_000_000);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("keeps seeded JingleYield active when minimum cycles and interest target are not reached, while rolling locked principal forward", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);
      const user = TRADECRAFT_ACCEPTANCE_SEED.users.jingleYield;

      await openPlannedCycleWithStableRolloverCaps(
        api,
        seeded.cycles.plannedCycleId,
      );

      const program = await api<JingleYieldProgramSummary>(
        "GET",
        `/ledger/jingle-yield/programs/${seeded.jingleYieldProgramId}`,
      );
      expect(program).toEqual(
        expect.objectContaining({
          id: seeded.jingleYieldProgramId,
          userId: user.id,
          status: "ACTIVE",
          minCycles: 2,
        }),
      );
      expect(Number(program.lockedPrincipalIsk)).toBe(2_000_000_000);
      expect(Number(program.cumulativeInterestIsk)).toBeGreaterThan(
        500_000_000,
      );
      expect(Number(program.cumulativeInterestIsk)).toBeLessThan(
        2_000_000_000,
      );

      const targetCycleParticipations = await api<CycleParticipationResponse[]>(
        "GET",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/participations`,
      );
      expect(targetCycleParticipations).toContainEqual(
        expect.objectContaining({
          userId: user.id,
          status: "OPTED_IN",
          rolloverType: "INITIAL_ONLY",
          rolloverFromParticipationId:
            seeded.participations.jingleYieldRootParticipationId,
          jingleYieldProgramId: seeded.jingleYieldProgramId,
          userPrincipalIsk: "0",
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  test("completes JingleYield through the interest target and records admin principal repayment", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      await prisma.jingleYieldProgram.update({
        where: { id: seeded.jingleYieldProgramId },
        data: {
          targetInterestIsk: "510000000.00",
          minCycles: 12,
        },
      });

      await openPlannedCycleWithStableRolloverCaps(
        api,
        seeded.cycles.plannedCycleId,
      );

      const completed = await api<JingleYieldProgramSummary>(
        "GET",
        `/ledger/jingle-yield/programs/${seeded.jingleYieldProgramId}`,
      );
      expect(completed).toEqual(
        expect.objectContaining({
          id: seeded.jingleYieldProgramId,
          status: "COMPLETED_CONTINUING",
        }),
      );
      expect(Number(completed.lockedPrincipalIsk)).toBe(0);
      expect(Number(completed.cumulativeInterestIsk)).toBeGreaterThanOrEqual(
        510_000_000,
      );
      expect(completed.completedCycle?.id).toBe(seeded.cycles.openCycleId);

      const repayment = await prisma.cycleLedgerEntry.findFirst({
        where: {
          cycleId: seeded.cycles.openCycleId,
          jingleYieldProgramId: seeded.jingleYieldProgramId,
          beneficiaryType: "admin",
        },
        select: { entryType: true, amount: true, beneficiaryCharacterId: true },
      });
      expect(repayment).toEqual(
        expect.objectContaining({
          entryType: "payout",
          beneficiaryCharacterId: seeded.logisticsCharacterId,
        }),
      );
      expect(Number(repayment?.amount ?? 0)).toBe(2_000_000_000);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("completes JingleYield through minimum cycle rules even when interest target is not reached", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      await prisma.jingleYieldProgram.update({
        where: { id: seeded.jingleYieldProgramId },
        data: {
          targetInterestIsk: "999000000000.00",
          minCycles: 1,
        },
      });

      await openPlannedCycleWithStableRolloverCaps(
        api,
        seeded.cycles.plannedCycleId,
      );

      const completed = await api<JingleYieldProgramSummary>(
        "GET",
        `/ledger/jingle-yield/programs/${seeded.jingleYieldProgramId}`,
      );
      expect(completed).toEqual(
        expect.objectContaining({
          id: seeded.jingleYieldProgramId,
          status: "COMPLETED_CONTINUING",
          minCycles: 1,
        }),
      );
      expect(Number(completed.cumulativeInterestIsk)).toBeLessThan(
        999_000_000_000,
      );
      expect(Number(completed.lockedPrincipalIsk)).toBe(0);
      expect(completed.completedCycle?.id).toBe(seeded.cycles.openCycleId);
    } finally {
      await prisma.$disconnect();
    }
  });
});
