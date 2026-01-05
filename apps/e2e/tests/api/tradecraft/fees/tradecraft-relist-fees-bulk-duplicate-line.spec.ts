import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../../../testkit/db";

test.describe("Tradecraft relist fees (API)", () => {
  test("bulk relist fees increments the same line twice when passed duplicate lineId entries (ladder case)", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      const cycle = await prisma.cycle.create({
        data: {
          name: "E2E Open Cycle (relist fees bulk dup line)",
          status: "OPEN",
          startedAt: new Date(),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const line = await prisma.cycleLine.create({
        data: {
          cycleId: cycle.id,
          typeId: 34,
          destinationStationId: 60003760,
          plannedUnits: 100,
          unitsBought: 100,
          buyCostIsk: "1000000.00",
          unitsSold: 0,
          salesGrossIsk: "0.00",
          salesTaxIsk: "0.00",
          salesNetIsk: "0.00",
          brokerFeesIsk: "0.00",
          relistFeesIsk: "0.00",
          listedUnits: 0,
          currentSellPriceIsk: "100.00",
        },
        select: { id: true },
      });

      // Simulate laddered repricing: the UI may add multiple fee items for the same lineId.
      // We must ensure both increments are applied (not deduped/overwritten).
      await api("POST", "/ledger/fees/relist/bulk", {
        fees: [
          { lineId: line.id, amountIsk: "1.00" },
          { lineId: line.id, amountIsk: "2.00" },
        ],
      });

      const updated = await prisma.cycleLine.findUnique({
        where: { id: line.id },
        select: { relistFeesIsk: true },
      });

      expect(updated).not.toBeNull();
      expect(Number(updated!.relistFeesIsk)).toBe(3);
    } finally {
      await prisma.$disconnect();
    }
  });
});
