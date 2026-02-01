import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../../../testkit/db";

function apiUrl() {
  return process.env.API_URL ?? "http://localhost:3000";
}

function apiKey() {
  return process.env.E2E_API_KEY ?? "";
}

test.describe("Tradecraft admin manual participation (OPEN cycle) (API)", () => {
  test("admin can create a participation for an OPEN cycle by main character id; cycle initialCapitalIsk increments once; caps/edge cases enforced", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      // Seed a target user with a primary character.
      const now = Date.now();
      const userId = `e2e-manual-open-user-${now}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      const primaryCharacterId = 99_000_000 + (now % 1_000_000);

      // Create in 3 steps to satisfy FK + avoid mixing unchecked FK fields with nested writes.
      await prisma.user.create({ data: { id: userId, role: "USER" } });
      await prisma.eveCharacter.create({
        data: {
          id: primaryCharacterId,
          name: `E2E Manual Open ${userId.substring(0, 6)}`,
          ownerHash: `e2e-owner-${userId}`,
          userId,
        },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { primaryCharacterId },
      });

      // OPEN cycle with a known baseline initial capital.
      const openCycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle (manual participation)",
          status: "OPEN",
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const baseline = await prisma.cycle.findUnique({
        where: { id: openCycle.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(baseline?.initialCapitalIsk ?? 0)).toBe(1_000_000_000);

      // Create manual participation (valid). Defaults to markPaid=true.
      const created = await api<{ id: string; cycleId: string; userId: string }>(
        "POST",
        `/ledger/cycles/${openCycle.id}/participations/admin`,
        {
          primaryCharacterId,
          amountIsk: "5000000000.00",
        },
      );
      expect(created.cycleId).toBe(openCycle.id);
      expect(created.userId).toBe(userId);

      const p = await prisma.cycleParticipation.findUnique({
        where: { id: created.id },
        select: {
          cycleId: true,
          userId: true,
          characterName: true,
          amountIsk: true,
          userPrincipalIsk: true,
          status: true,
          validatedAt: true,
          memo: true,
        },
      });
      expect(p).not.toBeNull();
      expect(p!.cycleId).toBe(openCycle.id);
      expect(p!.userId).toBe(userId);
      expect(p!.status).toBe("OPTED_IN");
      expect(p!.validatedAt).toBeTruthy();
      expect(Number(p!.amountIsk)).toBe(5_000_000_000);
      expect(Number(p!.userPrincipalIsk)).toBe(5_000_000_000);
      expect(p!.memo).toContain(`ARB-${openCycle.id.substring(0, 8)}-`);

      const deposit = await prisma.cycleLedgerEntry.findFirst({
        where: { participationId: created.id, entryType: "deposit" },
        select: { amount: true },
      });
      expect(deposit).not.toBeNull();
      expect(Number(deposit!.amount)).toBe(5_000_000_000);

      const afterCreate = await prisma.cycle.findUnique({
        where: { id: openCycle.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(afterCreate?.initialCapitalIsk ?? 0)).toBe(6_000_000_000);

      // Idempotent: second call returns existing and does NOT increase initial capital again.
      const created2 = await api<{ id: string }>(
        "POST",
        `/ledger/cycles/${openCycle.id}/participations/admin`,
        {
          primaryCharacterId,
          amountIsk: "5000000000.00",
        },
      );
      expect(created2.id).toBe(created.id);

      const afterSecond = await prisma.cycle.findUnique({
        where: { id: openCycle.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(afterSecond?.initialCapitalIsk ?? 0)).toBe(6_000_000_000);

      // Edge case: cycle not OPEN -> 400
      const planned = await prisma.cycle.create({
        data: {
          name: "E2E Planned Cycle (manual participation should fail)",
          status: "PLANNED",
          startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });
      const resWrongStatus = await request.fetch(
        `${apiUrl()}/ledger/cycles/${planned.id}/participations/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { primaryCharacterId, amountIsk: "1000000000.00" },
        },
      );
      expect(resWrongStatus.ok()).toBe(false);
      expect(resWrongStatus.status()).toBe(400);
      expect(await resWrongStatus.text()).toContain("OPEN cycles");

      // Edge case: unknown primary character -> 400
      const resNoUser = await request.fetch(
        `${apiUrl()}/ledger/cycles/${openCycle.id}/participations/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { primaryCharacterId: 123456789, amountIsk: "1000000000.00" },
        },
      );
      expect(resNoUser.ok()).toBe(false);
      expect(resNoUser.status()).toBe(400);
      expect(await resNoUser.text()).toContain("No user found");

      // Edge case: cap enforcement -> 400 and cycle capital unchanged
      await api("PATCH", `/admin/users/${userId}/tradecraft-caps`, {
        principalCapIsk: "1000000000.00",
        maximumCapIsk: "1000000000.00",
      });

      const openCycle2 = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle 2 (cap enforcement)",
          status: "OPEN",
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          initialCapitalIsk: "0.00",
        },
        select: { id: true },
      });

      const resCap = await request.fetch(
        `${apiUrl()}/ledger/cycles/${openCycle2.id}/participations/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { primaryCharacterId, amountIsk: "2000000000.00" },
        },
      );
      expect(resCap.ok()).toBe(false);
      expect(resCap.status()).toBe(400);
      expect(await resCap.text()).toContain("exceeds");

      const afterCapFail = await prisma.cycle.findUnique({
        where: { id: openCycle2.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(afterCapFail?.initialCapitalIsk ?? 0)).toBe(0);

      // Optional flow: create as awaiting payment, then confirm later (no journal).
      await api("PATCH", `/admin/users/${userId}/tradecraft-caps`, {
        principalCapIsk: "10000000000.00",
        maximumCapIsk: "20000000000.00",
      });
      const openCycle3 = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle 3 (await then confirm)",
          status: "OPEN",
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          initialCapitalIsk: "0.00",
        },
        select: { id: true },
      });

      const awaiting = await api<{ id: string }>(
        "POST",
        `/ledger/cycles/${openCycle3.id}/participations/admin`,
        { primaryCharacterId, amountIsk: "3000000000.00", markPaid: false },
      );

      const pAwait = await prisma.cycleParticipation.findUnique({
        where: { id: awaiting.id },
        select: { status: true, validatedAt: true },
      });
      expect(pAwait?.status).toBe("AWAITING_INVESTMENT");
      expect(pAwait?.validatedAt).toBeNull();

      const cap0 = await prisma.cycle.findUnique({
        where: { id: openCycle3.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(cap0?.initialCapitalIsk ?? 0)).toBe(0);

      const resConfirm = await request.fetch(
        `${apiUrl()}/ledger/participations/${awaiting.id}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
          data: {},
        },
      );
      expect(resConfirm.ok()).toBe(true);

      const pConfirmed = await prisma.cycleParticipation.findUnique({
        where: { id: awaiting.id },
        select: { status: true, validatedAt: true },
      });
      expect(pConfirmed?.status).toBe("OPTED_IN");
      expect(pConfirmed?.validatedAt).toBeTruthy();

      const deposit2 = await prisma.cycleLedgerEntry.findFirst({
        where: { participationId: awaiting.id, entryType: "deposit" },
        select: { amount: true },
      });
      expect(Number(deposit2?.amount ?? 0)).toBe(3_000_000_000);

      const cap1 = await prisma.cycle.findUnique({
        where: { id: openCycle3.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(cap1?.initialCapitalIsk ?? 0)).toBe(3_000_000_000);
    } finally {
      await prisma.$disconnect();
    }
  });
});

