import type { CycleGroup, ParticipationWithCycle } from "./types";

export function deriveParticipationBuckets(participations: ParticipationWithCycle[]) {
  const awaitingPayment = participations.filter(
    (p) => p.status === "AWAITING_INVESTMENT",
  );
  const needsRefund = participations.filter(
    (p) => p.status === "OPTED_OUT" && !p.refundedAt,
  );
  const needsPayout = participations.filter(
    (p) => p.status === "AWAITING_PAYOUT" && !p.payoutPaidAt && p.payoutAmountIsk,
  );

  return { awaitingPayment, needsRefund, needsPayout };
}

export function groupParticipationsByCycle(
  participations: ParticipationWithCycle[],
): CycleGroup[] {
  const map = new Map<string, CycleGroup>();
  for (const p of participations) {
    const cycle = p.cycle;
    const cycleId = cycle?.id ?? p.cycleId;

    if (!map.has(cycleId)) {
      map.set(cycleId, {
        cycleId,
        cycleName: cycle?.name ?? null,
        cycleStatus: cycle?.status ?? "UNKNOWN",
        startedAt: cycle?.startedAt ?? null,
        closedAt: cycle?.closedAt ?? null,
        participations: [],
      });
    }

    map.get(cycleId)?.participations.push(p);
  }

  const statusRank = (status: string) =>
    status === "OPEN" ? 0 : status === "PLANNED" ? 1 : status === "COMPLETED" ? 2 : 3;

  return [...map.values()].sort((a, b) => {
    const rankDiff = statusRank(a.cycleStatus) - statusRank(b.cycleStatus);
    if (rankDiff !== 0) return rankDiff;

    const aDate = new Date(a.closedAt ?? a.startedAt ?? 0).getTime();
    const bDate = new Date(b.closedAt ?? b.startedAt ?? 0).getTime();
    return bDate - aDate;
  });
}

export function deriveVisibleCycleIds(cycles: CycleGroup[]) {
  const preferred = new Set(
    cycles
      .filter((cycle) => cycle.cycleStatus === "OPEN" || cycle.cycleStatus === "PLANNED")
      .map((cycle) => cycle.cycleId),
  );

  if (preferred.size > 0) {
    return preferred;
  }

  return new Set(cycles.length > 0 ? [cycles[0].cycleId] : []);
}
