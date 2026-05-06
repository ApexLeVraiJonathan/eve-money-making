import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma } from "../../../../testkit/db";
import { seedTradecraftAcceptance } from "../../../../testkit/tradecraft-acceptance-seed";

const EXPECTED = {
  realized: {
    grossSales: 900_000_000,
    salesTax: 45_000_000,
    netSales: 855_000_000,
    cogs: 600_000_000,
    brokerFees: 20_000_000,
    relistFees: 5_000_000,
    transportFees: 50_000_000,
    collateralRecovery: -25_000_000,
    lineProfitExclCycleFees: 230_000_000,
    cycleProfit: 205_000_000,
    roiPercent: 1.86,
  },
  nav: {
    deposits: 11_000_000_000,
    withdrawals: 1_000_000_000,
    fees: 0,
    executions: 0,
    net: 10_000_000_000,
  },
  inventory: {
    remainingUnits: 40,
    wacUnitCost: 10_000_000,
    costValue: 400_000_000,
    expectedSalesRevenue: 640_000_000,
    estimatedNetRevenue: 618_400_000,
    estimatedAdditionalProfit: 218_400_000,
  },
  snapshot: {
    walletCash: 10_805_000_000,
    inventory: 400_000_000,
    cycleProfit: 205_000_000,
  },
  payout: {
    profitSharePct: 0.5,
    totalPayout: 11_102_500_000,
  },
} as const;

type ProfitResponse = {
  lineProfitExclTransport: string;
  transportFees: string;
  cycleProfitCash: string;
  lineBreakdown: Array<{ lineId: string; profit: string }>;
};

type ProfitBreakdownResponse = {
  revenue: { grossSales: string; salesTax: string; netSales: string };
  cogs: { totalCogs: string; unitsSold: number; avgCostPerUnit: string };
  grossProfit: string;
  expenses: {
    transportFees: string;
    brokerFees: string;
    relistFees: string;
    collateralRecovery: string;
    totalExpenses: string;
  };
  netProfit: string;
  roi: { percentage: string; initialCapital: string };
};

type NavResponse = {
  deposits: string;
  withdrawals: string;
  fees: string;
  executions: string;
  net: string;
};

type PayoutSuggestResponse = {
  payouts: Array<{
    participationId: string;
    investmentIsk: string;
    profitShareIsk: string;
    totalPayoutIsk: string;
  }>;
  totalPayout: string;
};

type PortfolioResponse = {
  totalValue: string;
  inventoryValueAtCost: string;
  expectedSalesRevenue: string;
  breakdown: Array<{
    lineId: string;
    remainingUnits: number;
    wacUnitCost: string;
    inventoryValue: string;
    expectedSalesRevenue: string;
  }>;
};

type EstimatedProfitResponse = {
  currentProfit: string;
  estimatedTotalProfit: string;
  lineBreakdown: Array<{
    lineId: string;
    remainingUnits: number;
    currentProfit: string;
    estimatedRevenue: string;
  }>;
};

type SnapshotResponse = {
  walletCashIsk: string;
  inventoryIsk: string;
  cycleProfitIsk: string;
};

type SnapshotListItem = SnapshotResponse & {
  id: string;
  cycleId: string;
  snapshotAt: string;
};

type CycleOverviewResponse = {
  current: {
    id: string;
    profit: { current: number; estimated: number; portfolioValue: number };
    capital: { cash: number; inventory: number; total: number };
    participantCount: number;
    totalInvestorCapital: number;
  } | null;
  next: { id: string } | null;
};

test.describe("Tradecraft financial reporting acceptance", () => {
  test("reports coherent profit, NAV, payouts, inventory, snapshots, and overview values from the canonical seed", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);
      const cycleId = seeded.cycles.openCycleId;

      const profit = await api<ProfitResponse>(
        "GET",
        `/ledger/cycles/${cycleId}/profit`,
      );
      expect(Number(profit.lineProfitExclTransport)).toBe(
        EXPECTED.realized.lineProfitExclCycleFees,
      );
      expect(Number(profit.transportFees)).toBe(
        EXPECTED.realized.transportFees +
          EXPECTED.realized.collateralRecovery,
      );
      expect(Number(profit.cycleProfitCash)).toBe(
        EXPECTED.realized.cycleProfit,
      );
      expect(profit.lineBreakdown).toContainEqual(
        expect.objectContaining({
          lineId: seeded.cycleLineId,
          profit: EXPECTED.realized.lineProfitExclCycleFees.toFixed(2),
        }),
      );

      const breakdown = await api<ProfitBreakdownResponse>(
        "GET",
        `/ledger/cycles/${cycleId}/profit/breakdown`,
      );
      expect(Number(breakdown.revenue.grossSales)).toBe(
        EXPECTED.realized.grossSales,
      );
      expect(Number(breakdown.revenue.salesTax)).toBe(
        EXPECTED.realized.salesTax,
      );
      expect(Number(breakdown.revenue.netSales)).toBe(
        EXPECTED.realized.netSales,
      );
      expect(Number(breakdown.cogs.totalCogs)).toBe(EXPECTED.realized.cogs);
      expect(Number(breakdown.cogs.avgCostPerUnit)).toBe(
        EXPECTED.inventory.wacUnitCost,
      );
      expect(Number(breakdown.expenses.brokerFees)).toBe(
        EXPECTED.realized.brokerFees,
      );
      expect(Number(breakdown.expenses.relistFees)).toBe(
        EXPECTED.realized.relistFees,
      );
      expect(Number(breakdown.expenses.transportFees)).toBe(
        EXPECTED.realized.transportFees,
      );
      expect(Number(breakdown.expenses.collateralRecovery)).toBe(
        EXPECTED.realized.collateralRecovery,
      );
      expect(Number(breakdown.netProfit)).toBe(EXPECTED.realized.cycleProfit);
      expect(Number(breakdown.roi.percentage)).toBe(
        EXPECTED.realized.roiPercent,
      );

      const nav = await api<NavResponse>("GET", `/ledger/nav/${cycleId}`);
      expect(Number(nav.deposits)).toBe(EXPECTED.nav.deposits);
      expect(Number(nav.withdrawals)).toBe(EXPECTED.nav.withdrawals);
      expect(Number(nav.fees)).toBe(EXPECTED.nav.fees);
      expect(Number(nav.executions)).toBe(EXPECTED.nav.executions);
      expect(Number(nav.net)).toBe(EXPECTED.nav.net);

      const payouts = await api<PayoutSuggestResponse>(
        "GET",
        `/ledger/cycles/${cycleId}/payouts/suggest?profitSharePct=${EXPECTED.payout.profitSharePct}`,
      );
      expect(Number(payouts.totalPayout)).toBe(EXPECTED.payout.totalPayout);
      expect(payouts.payouts).toHaveLength(4);
      expect(payouts.payouts).toContainEqual(
        expect.objectContaining({
          participationId: seeded.participations.jingleYieldRootParticipationId,
          investmentIsk: "2000000000.00",
          profitShareIsk: "18636363.64",
          totalPayoutIsk: "2018636363.64",
        }),
      );

      const portfolio = await api<PortfolioResponse>(
        "GET",
        `/ledger/cycles/${cycleId}/profit/portfolio`,
      );
      expect(Number(portfolio.inventoryValueAtCost)).toBe(
        EXPECTED.inventory.costValue,
      );
      expect(Number(portfolio.expectedSalesRevenue)).toBe(
        EXPECTED.inventory.expectedSalesRevenue,
      );
      expect(Number(portfolio.totalValue)).toBe(
        EXPECTED.inventory.costValue + EXPECTED.inventory.expectedSalesRevenue,
      );
      expect(portfolio.breakdown).toContainEqual(
        expect.objectContaining({
          lineId: seeded.cycleLineId,
          remainingUnits: EXPECTED.inventory.remainingUnits,
          wacUnitCost: EXPECTED.inventory.wacUnitCost.toFixed(2),
          inventoryValue: EXPECTED.inventory.costValue.toFixed(2),
          expectedSalesRevenue:
            EXPECTED.inventory.expectedSalesRevenue.toFixed(2),
        }),
      );

      const estimated = await api<EstimatedProfitResponse>(
        "GET",
        `/ledger/cycles/${cycleId}/profit/estimated`,
      );
      expect(Number(estimated.currentProfit)).toBe(
        EXPECTED.realized.cycleProfit,
      );
      expect(Number(estimated.estimatedTotalProfit)).toBeGreaterThan(
        EXPECTED.realized.cycleProfit,
      );
      expect(Number(estimated.estimatedTotalProfit)).toBe(
        EXPECTED.realized.cycleProfit +
          EXPECTED.inventory.estimatedAdditionalProfit,
      );
      expect(estimated.lineBreakdown).toContainEqual(
        expect.objectContaining({
          lineId: seeded.cycleLineId,
          remainingUnits: EXPECTED.inventory.remainingUnits,
          currentProfit: EXPECTED.realized.lineProfitExclCycleFees.toFixed(2),
          estimatedRevenue: EXPECTED.inventory.estimatedNetRevenue.toFixed(2),
        }),
      );

      const snapshot = await api<SnapshotResponse>(
        "POST",
        `/ledger/cycles/${cycleId}/snapshot`,
        {},
      );
      expect(Number(snapshot.walletCashIsk)).toBe(EXPECTED.snapshot.walletCash);
      expect(Number(snapshot.inventoryIsk)).toBe(EXPECTED.snapshot.inventory);
      expect(Number(snapshot.cycleProfitIsk)).toBe(
        EXPECTED.snapshot.cycleProfit,
      );

      const snapshots = await api<SnapshotListItem[]>(
        "GET",
        `/ledger/cycles/${cycleId}/snapshots`,
      );
      const createdSnapshot = snapshots.find(
        (item) =>
          item.cycleId === cycleId &&
          Number(item.walletCashIsk) === EXPECTED.snapshot.walletCash,
      );
      expect(createdSnapshot).toBeDefined();
      expect(Number(createdSnapshot?.inventoryIsk ?? 0)).toBe(
        EXPECTED.snapshot.inventory,
      );
      expect(Number(createdSnapshot?.cycleProfitIsk ?? 0)).toBe(
        EXPECTED.snapshot.cycleProfit,
      );

      const entries = await api<
        Array<{ entryType: string; amount: string; memo: string | null }>
      >("GET", `/ledger/entries?cycleId=${cycleId}&limit=10`);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entryType: "deposit",
            amount: "4000000000",
          }),
          expect.objectContaining({
            entryType: "withdrawal",
            amount: "1000000000",
          }),
        ]),
      );

      const overview = await api<CycleOverviewResponse>(
        "GET",
        "/ledger/cycles/overview",
      );
      expect(overview.current).toEqual(
        expect.objectContaining({
          id: cycleId,
          participantCount: 4,
          totalInvestorCapital: EXPECTED.nav.deposits,
        }),
      );
      expect(overview.current?.profit.current).toBe(
        EXPECTED.realized.cycleProfit,
      );
      expect(overview.current?.capital.inventory).toBe(
        EXPECTED.inventory.costValue,
      );
      expect(overview.current?.capital.total).toBe(
        EXPECTED.nav.deposits + EXPECTED.realized.cycleProfit,
      );
      expect(overview.next?.id).toBe(seeded.cycles.plannedCycleId);
    } finally {
      await prisma.$disconnect();
    }
  });
});
