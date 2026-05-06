import { isActiveParticipation } from "./participation-status";
import type { MyInvestmentParticipation } from "./types";

export type InvestmentsMetrics = {
  completedCount: number;
  activeCount: number;
  totalCycles: number;
  totalProfit: number;
  averageRoi: number;
  activeInvestment: number;
};

export function calculateInvestmentsMetrics(
  participations: MyInvestmentParticipation[],
): InvestmentsMetrics {
  const completedCycles = participations.filter((p) => p.status === "COMPLETED");
  const activeCycles = participations.filter((p) =>
    isActiveParticipation(p.status),
  );

  const totalProfit = completedCycles.reduce((sum, p) => {
    const payoutReceived = Number(p.payoutAmountIsk || 0);
    const rolloverDeducted = Number(p.rolloverDeductedIsk || 0);
    const fullPayout = payoutReceived + rolloverDeducted;
    const invested = Number(p.amountIsk);
    const profit = fullPayout > 0 ? fullPayout - invested : 0;
    return sum + profit;
  }, 0);

  const totalInvestedInCompletedCycles = completedCycles.reduce(
    (sum, p) => sum + Number(p.amountIsk),
    0,
  );

  const averageRoi =
    totalInvestedInCompletedCycles > 0
      ? (totalProfit / totalInvestedInCompletedCycles) * 100
      : 0;

  const activeInvestment = activeCycles.reduce(
    (sum, p) => sum + Number(p.amountIsk),
    0,
  );

  return {
    completedCount: completedCycles.length,
    activeCount: activeCycles.length,
    totalCycles: participations.length,
    totalProfit,
    averageRoi,
    activeInvestment,
  };
}
