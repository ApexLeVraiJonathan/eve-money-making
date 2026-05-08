import type { CycleOverview } from "@eve/shared/tradecraft-cycles";
import type { CycleParticipation } from "@eve/shared/tradecraft-participations";
import type {
  CapitalDistributionDatum,
  CapitalTrendPoint,
  CycleDetailsCycle,
  CycleDetailsSnapshot,
  ProfitTrendPoint,
} from "./types";

const MILLION = 1_000_000;
const INVESTOR_PROFIT_SHARE = 0.5;

function formatSnapshotDate(snapshotAt: string) {
  return new Date(snapshotAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getCycleWithParticipation(
  overview: CycleOverview | undefined,
  myParticipation: CycleParticipation | null | undefined,
): CycleDetailsCycle | null {
  if (!overview?.current) return null;
  return { ...overview.current, myParticipation };
}

export function getStartingCapital(cycle: CycleDetailsCycle): number {
  return Math.max(cycle.initialCapitalIsk, cycle.totalInvestorCapital);
}

export function getCurrentPortfolioValue(cycle: CycleDetailsCycle): number {
  return getStartingCapital(cycle) + cycle.profit.current;
}

export function getCurrentCash(cycle: CycleDetailsCycle): number {
  return getCurrentPortfolioValue(cycle) - cycle.capital.inventory;
}

export function getCapitalDistributionData(
  cycle: CycleDetailsCycle | null,
): CapitalDistributionDatum[] {
  if (!cycle) return [];

  return [
    {
      name: "Cash",
      value: getCurrentCash(cycle),
      fill: "#d97706",
    },
    {
      name: "Inventory",
      value: cycle.capital.inventory,
      fill: "#92400e",
    },
  ];
}

export function getEstimatedParticipationPayout(
  cycle: CycleDetailsCycle,
): number | null {
  const participation = cycle.myParticipation;
  if (!participation) return null;

  if (participation.payoutAmountIsk !== null) {
    return Number(participation.payoutAmountIsk);
  }

  const investment = Number(participation.amountIsk);
  if (investment <= 0 || cycle.totalInvestorCapital <= 0) return null;

  const share = investment / cycle.totalInvestorCapital;
  const estimatedProfitShare =
    cycle.profit.estimated * INVESTOR_PROFIT_SHARE * share;
  return investment + estimatedProfitShare;
}

export function sortSnapshotsByDate(
  snapshots: CycleDetailsSnapshot[],
): CycleDetailsSnapshot[] {
  return [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  );
}

export function getCapitalOverTimeData(
  snapshots: CycleDetailsSnapshot[],
): CapitalTrendPoint[] {
  return snapshots.map((snap) => ({
    date: formatSnapshotDate(snap.snapshotAt),
    cash: parseFloat(snap.walletCashIsk) / MILLION,
    inventory: parseFloat(snap.inventoryIsk) / MILLION,
    total:
      (parseFloat(snap.walletCashIsk) + parseFloat(snap.inventoryIsk)) /
      MILLION,
  }));
}

export function getProfitOverTimeData(
  snapshots: CycleDetailsSnapshot[],
): ProfitTrendPoint[] {
  return snapshots.map((snap) => ({
    date: formatSnapshotDate(snap.snapshotAt),
    profit: parseFloat(snap.cycleProfitIsk) / MILLION,
  }));
}
