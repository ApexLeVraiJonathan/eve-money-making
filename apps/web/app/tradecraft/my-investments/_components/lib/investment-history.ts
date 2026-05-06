import type { MyInvestmentParticipation } from "./types";

export type InvestmentHistoryRow = {
  id: string;
  cycleLabel: string;
  principal: number;
  invested: number;
  totalPayout: number;
  rolloverDeducted: number;
  profitShare: number;
  roi: number;
  isPaid: boolean;
  statusLabel: string;
  createdDateLabel: string;
};

export function toInvestmentHistoryRow(
  participation: MyInvestmentParticipation,
): InvestmentHistoryRow {
  const invested = Number(participation.amountIsk);
  const rawPrincipal = Number(participation.userPrincipalIsk);
  const principal = Number.isFinite(rawPrincipal) ? rawPrincipal : invested;
  const payoutReceived = Number(participation.payoutAmountIsk || 0);
  const rolloverDeducted = Number(participation.rolloverDeductedIsk || 0);
  const fullPayout = payoutReceived + rolloverDeducted;
  const profitShare = fullPayout > 0 ? fullPayout - invested : 0;
  const totalPayout = fullPayout > 0 ? fullPayout : 0;
  const roi = invested > 0 ? (profitShare / invested) * 100 : 0;

  return {
    id: participation.id,
    cycleLabel: participation.cycle?.name || participation.cycleId.slice(0, 8),
    principal,
    invested,
    totalPayout,
    rolloverDeducted,
    profitShare,
    roi,
    isPaid: Boolean(participation.payoutPaidAt),
    statusLabel: participation.status.replace(/_/g, " "),
    createdDateLabel: new Date(participation.createdAt).toLocaleDateString(),
  };
}
