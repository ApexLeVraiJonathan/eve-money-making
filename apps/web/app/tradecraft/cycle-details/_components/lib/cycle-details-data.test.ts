import { describe, expect, it } from "vitest";
import {
  getCapitalDistributionData,
  getCurrentPortfolioValue,
  getEstimatedParticipationPayout,
  getStartingCapital,
} from "./cycle-details-data";
import type { CycleDetailsCycle } from "./types";

function makeCycle(
  overrides: Partial<CycleDetailsCycle> = {},
): CycleDetailsCycle {
  return {
    id: "cycle-13",
    name: "Cycle 13",
    startedAt: "2026-05-07T00:00:00.000Z",
    endsAt: "2026-05-21T00:00:00.000Z",
    status: "Open",
    profit: {
      current: 68_583_995.67,
      estimated: 4_773_330_235.07,
      portfolioValue: 0,
    },
    capital: {
      cash: 68_583_995.67,
      inventory: 75_702_000_000,
      total: 68_583_995.67,
    },
    initialCapitalIsk: 0,
    participantCount: 11,
    totalInvestorCapital: 142_454_126_551.71,
    myParticipation: {
      id: "participation-1",
      cycleId: "cycle-13",
      userId: "user-1",
      characterName: "Investor",
      amountIsk: "20000000000.00",
      userPrincipalIsk: "20000000000.00",
      status: "OPTED_IN",
      memo: "",
      validatedAt: "2026-05-07T00:00:00.000Z",
      walletJournalId: null,
      payoutAmountIsk: null,
      payoutPaidAt: null,
      rolloverDeductedIsk: null,
      refundAmountIsk: null,
      refundedAt: null,
      optedOutAt: null,
      jingleYieldProgramId: null,
      rolloverType: null,
      rolloverRequestedAmountIsk: null,
      rolloverFromParticipationId: null,
      createdAt: "2026-05-07T00:00:00.000Z",
      updatedAt: "2026-05-07T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("cycle details data", () => {
  it("uses investor capital when the persisted starting capital is stale", () => {
    const cycle = makeCycle();

    expect(getStartingCapital(cycle)).toBe(142_454_126_551.71);
    expect(getCurrentPortfolioValue(cycle)).toBeCloseTo(142_522_710_547.38, 2);

    const distribution = getCapitalDistributionData(cycle);
    expect(distribution[0]).toMatchObject({
      name: "Cash",
      fill: "#d97706",
    });
    expect(distribution[0]?.value).toBeCloseTo(66_820_710_547.38, 2);
    expect(distribution[1]).toEqual({
      name: "Inventory",
      value: 75_702_000_000,
      fill: "#92400e",
    });
  });

  it("estimates open-cycle participation payout from estimated profit", () => {
    const cycle = makeCycle();

    expect(getEstimatedParticipationPayout(cycle)).toBeCloseTo(
      20_335_078_410.9,
      2,
    );
  });

  it("prefers finalized payout amount when one exists", () => {
    const cycle = makeCycle({
      myParticipation: {
        ...makeCycle().myParticipation!,
        payoutAmountIsk: "21000000000.00",
      },
    });

    expect(getEstimatedParticipationPayout(cycle)).toBe(21_000_000_000);
  });
});
