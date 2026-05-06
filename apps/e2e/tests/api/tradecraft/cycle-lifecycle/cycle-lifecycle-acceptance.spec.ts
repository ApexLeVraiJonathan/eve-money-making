import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma } from "../../../../testkit/db";
import { seedTradecraftAcceptance } from "../../../../testkit/tradecraft-acceptance-seed";

type CycleLifecycleResponse = {
  cycle: {
    id: string;
    status: string;
  };
  settlementReport: {
    settledCycleId: string | null;
    targetCycleId: string | null;
    steps: Array<{
      name: string;
      kind: string;
      status: string;
      message?: string;
    }>;
    recoverableFailures: Array<{
      name: string;
      kind: string;
      status: string;
      message?: string;
    }>;
  };
};

test.describe("Tradecraft Cycle Lifecycle acceptance", () => {
  test("opening the Planned Cycle settles the prior Open Cycle and returns a Settlement Report", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      const result = await api<CycleLifecycleResponse>(
        "POST",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/open`,
        {},
      );

      expect(result.cycle).toEqual(
        expect.objectContaining({
          id: seeded.cycles.plannedCycleId,
          status: "OPEN",
        }),
      );
      expect(result.settlementReport.settledCycleId).toBe(
        seeded.cycles.openCycleId,
      );
      expect(result.settlementReport.targetCycleId).toBe(
        seeded.cycles.plannedCycleId,
      );
      expect(result.settlementReport.steps.map((step) => step.name)).toEqual([
        "wallet_import",
        "transaction_allocation",
        "rollover_buyback",
        "close_previous_cycle",
        "payout_creation",
        "cycle_rollover",
      ]);
      expect(result.settlementReport.steps).toEqual([
        expect.objectContaining({
          name: "wallet_import",
          kind: "strict",
          status: "succeeded",
        }),
        expect.objectContaining({
          name: "transaction_allocation",
          kind: "strict",
          status: "succeeded",
        }),
        expect.objectContaining({
          name: "rollover_buyback",
          kind: "strict",
          status: "succeeded",
        }),
        expect.objectContaining({
          name: "close_previous_cycle",
          kind: "strict",
          status: "succeeded",
        }),
        expect.objectContaining({
          name: "payout_creation",
          kind: "recoverable",
          status: "succeeded",
        }),
        expect.objectContaining({
          name: "cycle_rollover",
          kind: "recoverable",
          status: "succeeded",
        }),
      ]);
      expect(result.settlementReport.recoverableFailures).toEqual([]);

      const [previousOpen, openedTarget, openCycleCount] = await Promise.all([
        prisma.cycle.findUnique({
          where: { id: seeded.cycles.openCycleId },
          select: { status: true, closedAt: true },
        }),
        prisma.cycle.findUnique({
          where: { id: seeded.cycles.plannedCycleId },
          select: { status: true, initialCapitalIsk: true },
        }),
        prisma.cycle.count({ where: { status: "OPEN" } }),
      ]);

      expect(previousOpen).toEqual(
        expect.objectContaining({
          status: "COMPLETED",
        }),
      );
      expect(previousOpen?.closedAt).not.toBeNull();
      expect(openedTarget).toEqual(
        expect.objectContaining({
          status: "OPEN",
        }),
      );
      expect(openCycleCount).toBe(1);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("settling the Open Cycle without a successor creates a No Open Cycle Period", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      const result = await api<CycleLifecycleResponse>(
        "POST",
        `/ledger/cycles/${seeded.cycles.openCycleId}/close`,
        {},
      );

      expect(result.cycle).toEqual(
        expect.objectContaining({
          id: seeded.cycles.openCycleId,
          status: "COMPLETED",
        }),
      );
      expect(result.settlementReport.settledCycleId).toBe(
        seeded.cycles.openCycleId,
      );
      expect(result.settlementReport.targetCycleId).toBeNull();
      expect(result.settlementReport.steps.map((step) => step.name)).toEqual([
        "wallet_import",
        "transaction_allocation",
        "rollover_buyback",
        "close_previous_cycle",
        "payout_creation",
        "cycle_rollover",
      ]);
      expect(result.settlementReport.steps).toContainEqual(
        expect.objectContaining({
          name: "cycle_rollover",
          kind: "recoverable",
          status: "skipped",
          message:
            "No target Cycle; Rollover Intent becomes payout/admin follow-up",
        }),
      );
      expect(result.settlementReport.recoverableFailures).toEqual([]);

      const [closedCycle, stillPlannedCycle, openCycleCount] =
        await Promise.all([
          prisma.cycle.findUnique({
            where: { id: seeded.cycles.openCycleId },
            select: { status: true, closedAt: true },
          }),
          prisma.cycle.findUnique({
            where: { id: seeded.cycles.plannedCycleId },
            select: { status: true },
          }),
          prisma.cycle.count({ where: { status: "OPEN" } }),
        ]);

      expect(closedCycle).toEqual(
        expect.objectContaining({
          status: "COMPLETED",
        }),
      );
      expect(closedCycle?.closedAt).not.toBeNull();
      expect(stillPlannedCycle).toEqual(
        expect.objectContaining({
          status: "PLANNED",
        }),
      );
      expect(openCycleCount).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
