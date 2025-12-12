import { test, expect } from "@playwright/test";
import { createApiCall } from "../../testkit/api";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../testkit/db";

test.describe("Auto rollover (API)", () => {
  test("settings + planCycle auto-creates rollover participation", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      // Seed an OPEN cycle and an eligible participation for the admin user.
      const openCycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle",
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const openParticipation = await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: adminUserId,
          characterName: "E2E Admin",
          amountIsk: "1000000000.00",
          memo: `ARB-${openCycle.id.substring(0, 8)}-${adminUserId.substring(
            0,
            8
          )}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
        select: { id: true },
      });

      const api = createApiCall(request);

      // Update settings
      const updated = await api<{
        enabled: boolean;
        defaultRolloverType: "FULL_PAYOUT" | "INITIAL_ONLY";
      }>("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: true,
        defaultRolloverType: "INITIAL_ONLY",
      });
      expect(updated.enabled).toBe(true);
      expect(updated.defaultRolloverType).toBe("INITIAL_ONLY");

      // Plan a cycle -> should create a rollover participation stub in that planned cycle.
      const planned = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover = await prisma.cycleParticipation.findFirst({
        where: {
          cycleId: planned.id,
          userId: adminUserId,
          rolloverType: { not: null },
          rolloverFromParticipationId: openParticipation.id,
        },
        select: {
          id: true,
          rolloverType: true,
          status: true,
        },
      });

      expect(rollover).not.toBeNull();
      expect(rollover!.rolloverType).toBe("INITIAL_ONLY");
      expect(rollover!.status).toBe("AWAITING_INVESTMENT");
    } finally {
      await prisma.$disconnect();
    }
  });

  test("FULL_PAYOUT creates a rollover participation with rolloverType=FULL_PAYOUT", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const openCycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle",
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const openParticipation = await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: adminUserId,
          characterName: "E2E Admin",
          amountIsk: "1000000000.00",
          memo: `ARB-${openCycle.id.substring(0, 8)}-${adminUserId.substring(
            0,
            8
          )}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
        select: { id: true },
      });

      const api = createApiCall(request);

      await api("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: true,
        defaultRolloverType: "FULL_PAYOUT",
      });

      const planned = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover = await prisma.cycleParticipation.findFirst({
        where: {
          cycleId: planned.id,
          userId: adminUserId,
          rolloverType: "FULL_PAYOUT",
          rolloverFromParticipationId: openParticipation.id,
        },
        select: { id: true, rolloverType: true, status: true, memo: true },
      });

      expect(rollover).not.toBeNull();
      expect(rollover!.rolloverType).toBe("FULL_PAYOUT");
      expect(rollover!.status).toBe("AWAITING_INVESTMENT");
      expect(String(rollover!.memo)).toContain("ROLLOVER-");
    } finally {
      await prisma.$disconnect();
    }
  });

  test("if there is no OPEN cycle, planning a cycle does not auto-create rollover participations", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      await api("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: true,
        defaultRolloverType: "INITIAL_ONLY",
      });

      const planned = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (no open)",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover = await prisma.cycleParticipation.findFirst({
        where: {
          cycleId: planned.id,
          userId: adminUserId,
          rolloverType: { not: null },
        },
        select: { id: true },
      });
      expect(rollover).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("if user is not eligible (no OPTED_IN/AWAITING_PAYOUT in OPEN cycle), planning a cycle does not auto-create", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      // OPEN cycle exists, but user has no eligible participation
      await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle (ineligible user)",
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
      });

      const api = createApiCall(request);
      await api("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: true,
        defaultRolloverType: "INITIAL_ONLY",
      });

      const planned = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (ineligible)",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover = await prisma.cycleParticipation.findFirst({
        where: { cycleId: planned.id, userId: adminUserId, rolloverType: { not: null } },
        select: { id: true },
      });

      expect(rollover).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("disabling auto-rollover prevents auto-creation for subsequent planned cycles", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const openCycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle",
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: adminUserId,
          characterName: "E2E Admin",
          amountIsk: "1000000000.00",
          memo: `ARB-${openCycle.id.substring(0, 8)}-${adminUserId.substring(0, 8)}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
      });

      const api = createApiCall(request);

      // Enable, plan -> should create
      await api("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: true,
        defaultRolloverType: "INITIAL_ONLY",
      });

      const planned1 = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (enabled)",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover1 = await prisma.cycleParticipation.findFirst({
        where: { cycleId: planned1.id, userId: adminUserId, rolloverType: { not: null } },
        select: { id: true },
      });
      expect(rollover1).not.toBeNull();

      // Disable, plan -> should not create
      await api("PATCH", "/ledger/participations/auto-rollover-settings", {
        enabled: false,
        defaultRolloverType: "INITIAL_ONLY",
      });

      const planned2 = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (disabled)",
        startedAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const rollover2 = await prisma.cycleParticipation.findFirst({
        where: { cycleId: planned2.id, userId: adminUserId, rolloverType: { not: null } },
        select: { id: true },
      });
      expect(rollover2).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });
});
