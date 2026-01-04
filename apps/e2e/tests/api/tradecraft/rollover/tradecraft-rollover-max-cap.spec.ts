import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma, ensureE2eAdmin, resetTradecraftData } from "../../../../testkit/db";

function apiUrl() {
  return process.env.API_URL ?? "http://localhost:3000";
}

function apiKey() {
  return process.env.E2E_API_KEY ?? "";
}

test.describe("Tradecraft rollover maximum cap (API)", () => {
  test("FULL_PAYOUT rollover reinvests up to maximum cap and pays out excess interest", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      // Explicit defaults (so the expectation is clear)
      await api("PATCH", `/admin/users/${adminUserId}/tradecraft-caps`, {
        principalCapIsk: "10000000000.00", // 10B
        maximumCapIsk: "20000000000.00", // 20B
      });

      // Closed cycle (starts OPEN, will be closed via API)
      const openCycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle (rollover max cap)",
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      // Next cycle that will receive rollover
      const plannedCycle = await prisma.cycle.create({
        data: {
          name: "E2E Planned Cycle (rollover max cap)",
          status: "PLANNED",
          startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      // Participation in open cycle: 10B principal, opted in + validated
      const fromP = await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: adminUserId,
          characterName: "E2E Admin",
          amountIsk: "10000000000.00",
          userPrincipalIsk: "10000000000.00",
          memo: `ARB-${openCycle.id.substring(0, 8)}-${adminUserId.substring(0, 8)}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
        select: { id: true },
      });

      // Rollover participation stub in planned cycle (FULL_PAYOUT)
      const rollover = await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: adminUserId,
          characterName: "E2E Admin",
          // placeholder (will be replaced on rollover processing)
          amountIsk: "1.00",
          userPrincipalIsk: "10000000000.00",
          memo: `ROLLOVER-${plannedCycle.id.substring(0, 8)}-${fromP.id.substring(0, 8)}-FULL`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "FULL_PAYOUT",
          rolloverRequestedAmountIsk: "10000000000.00",
          rolloverFromParticipationId: fromP.id,
        },
        select: { id: true },
      });

      // Create a cycle line that yields 40B profit (so profit-to-investors = 20B at 50%).
      await prisma.cycleLine.create({
        data: {
          cycleId: openCycle.id,
          typeId: 34,
          destinationStationId: 60003760,
          plannedUnits: 1,
          unitsBought: 1,
          unitsSold: 1,
          buyCostIsk: "0.00",
          salesGrossIsk: "40000000000.00",
          salesTaxIsk: "0.00",
          salesNetIsk: "40000000000.00",
          brokerFeesIsk: "0.00",
          relistFeesIsk: "0.00",
          listedUnits: 0,
        },
      });

      // Close the cycle via API (this triggers payout creation and rollover processing).
      const closeRes = await request.fetch(`${apiUrl()}/ledger/cycles/${openCycle.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey() },
        data: {},
      });
      if (!closeRes.ok()) {
        const body = await closeRes.text().catch(() => "");
        throw new Error(
          `Close cycle failed: ${closeRes.status()} ${closeRes.statusText()}\n${body}`,
        );
      }

      // Reload the participations and verify max-cap behavior:
      // Investment 10B, profit share 20B -> total payout 30B.
      // Maximum cap 20B => roll 20B and pay out 10B.
      const updatedFrom = await prisma.cycleParticipation.findUnique({
        where: { id: fromP.id },
        select: {
          payoutAmountIsk: true,
          rolloverDeductedIsk: true,
          status: true,
        },
      });
      expect(updatedFrom).not.toBeNull();
      expect(Number(updatedFrom!.rolloverDeductedIsk)).toBe(20_000_000_000);
      expect(Number(updatedFrom!.payoutAmountIsk)).toBe(10_000_000_000);
      expect(updatedFrom!.status).toBe("AWAITING_PAYOUT");

      const updatedRollover = await prisma.cycleParticipation.findUnique({
        where: { id: rollover.id },
        select: { amountIsk: true, status: true },
      });
      expect(updatedRollover).not.toBeNull();
      expect(Number(updatedRollover!.amountIsk)).toBe(20_000_000_000);
      expect(updatedRollover!.status).toBe("OPTED_IN");
    } finally {
      await prisma.$disconnect();
    }
  });
});


