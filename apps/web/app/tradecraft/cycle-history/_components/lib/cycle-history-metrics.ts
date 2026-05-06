import type { CycleHistoryCycle, CycleHistoryMetrics } from "./types";

export function buildCycleHistoryMetrics(
  cycles: CycleHistoryCycle[],
): CycleHistoryMetrics {
  const totalCycles = cycles.length;
  const averageDurationDays =
    totalCycles > 0
      ? Math.round(
          cycles.reduce((sum, cycle) => sum + (cycle.durationDays ?? 0), 0) /
            totalCycles,
        )
      : 0;

  const totalProfitIsk = cycles.reduce(
    (sum, cycle) => sum + Number(cycle.profitIsk),
    0,
  );

  const averageRoiPercent =
    totalCycles > 0
      ? cycles.reduce((sum, cycle) => sum + Number(cycle.roiPercent), 0) /
        totalCycles
      : 0;

  const profitableCycles = cycles.filter(
    (cycle) => Number(cycle.profitIsk) > 0,
  ).length;
  const winRatePercent =
    totalCycles > 0 ? (profitableCycles / totalCycles) * 100 : 0;

  return {
    totalCycles,
    averageDurationDays,
    totalProfitIsk,
    averageRoiPercent,
    profitableCycles,
    winRatePercent,
  };
}
