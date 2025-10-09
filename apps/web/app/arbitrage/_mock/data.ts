export type ArbitrageCommit = {
  id: string;
  name: string;
  openedAt: string;
  closedAt?: string; // undefined when open
  totals: {
    investedISK: number; // capital moved into inventory in this commit
    soldISK: number; // realized sales so far
    estSellISK: number; // value of active sell orders at listing prices
    estFeesISK: number; // estimated fees on sold + to-be-sold
    estProfitISK: number; // (sold + estSell) - (invested + estFees)
    estReturnPct: number; // estProfit / invested
  };
};

export type CycleStatus = "Planned" | "Open" | "Closed";

export type ArbitrageCycle = {
  id: string;
  name: string;
  startedAt: string;
  endsAt: string;
  status: CycleStatus;
  commits: ArbitrageCommit[];
  capital: {
    originalInvestmentISK: number;
    cashISK: number;
    inventoryISK: number; // estimated current inventory valuation
  };
  performance: {
    marginPct: number; // overall cycle margin (est.)
    profitISK: number; // realized + unrealized profit (est.)
  };
};

export type ParticipationStatus =
  | "Awaiting-Investment"
  | "Awaiting-Validation"
  | "Opted-In"
  | "Completed";

export type InvestorParticipation = {
  characterName: string; // anonymized in public lists; shown only to owner
  amountISK: number;
  status: ParticipationStatus;
  memo: string; // donation reason to include in ISK transfer
  cycleId: string;
  estimatedPayoutISK: number; // based on 50% profit share pro-rata
};

export const MOCK_CURRENT_CYCLE: ArbitrageCycle = {
  id: "CY-2025-10-01",
  name: "October Cycle",
  startedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
  endsAt: new Date(Date.now() + 9 * 864e5).toISOString(),
  status: "Open",
  commits: [
    {
      id: "CM-1",
      name: "Kickoff",
      openedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
      closedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
      totals: {
        investedISK: 6_000_000_000,
        soldISK: 3_600_000_000,
        estSellISK: 3_300_000_000,
        estFeesISK: 250_000_000,
        estProfitISK:
          3_600_000_000 + 3_300_000_000 - (6_000_000_000 + 250_000_000),
        estReturnPct:
          (3_600_000_000 + 3_300_000_000 - (6_000_000_000 + 250_000_000)) /
          6_000_000_000,
      },
    },
    {
      id: "CM-2",
      name: "Expansion",
      openedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
      totals: {
        investedISK: 3_000_000_000,
        soldISK: 1_200_000_000,
        estSellISK: 2_250_000_000,
        estFeesISK: 100_000_000,
        estProfitISK:
          1_200_000_000 + 2_250_000_000 - (3_000_000_000 + 100_000_000),
        estReturnPct:
          (1_200_000_000 + 2_250_000_000 - (3_000_000_000 + 100_000_000)) /
          3_000_000_000,
      },
    },
  ],
  capital: {
    originalInvestmentISK: 10_000_000_000,
    cashISK: 3_000_000_000,
    inventoryISK: 8_000_000_000,
  },
  performance: {
    marginPct: 0.1,
    profitISK: 1_000_000_000,
  },
};

export const MOCK_NEXT_CYCLE: Pick<
  ArbitrageCycle,
  "id" | "name" | "startedAt" | "endsAt" | "status"
> = {
  id: "CY-2025-11-01",
  name: "November Cycle",
  startedAt: new Date(Date.now() + 10 * 864e5).toISOString(),
  endsAt: new Date(Date.now() + 40 * 864e5).toISOString(),
  status: "Planned",
};

export const MOCK_PARTICIPATION_SELF: InvestorParticipation = {
  characterName: "You",
  amountISK: 2_000_000_000,
  status: "Opted-In",
  memo: "ARB CY-2025-11-01 <YourName>",
  cycleId: "CY-2025-11-01",
  estimatedPayoutISK: 200_000_000, // example with 20% margin → 10% payout
};

export function estimatePayout(
  totalProfitISK: number,
  yourContributionISK: number,
  totalInvestedISK: number
): number {
  if (totalInvestedISK <= 0) return 0;
  const pool = totalProfitISK * 0.5;
  return (pool * yourContributionISK) / totalInvestedISK;
}
