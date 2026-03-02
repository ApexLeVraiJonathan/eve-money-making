import { formatIsk } from "@/lib/utils";

export function loserRate(x: { loserRuns: number; runs: number }) {
  return x.runs > 0 ? x.loserRuns / x.runs : 0;
}

export function redRate(x: { redRuns: number; runs: number }) {
  return x.runs > 0 ? x.redRuns / x.runs : 0;
}

export function avgLossPerLoserRun(x: {
  totalLossCashIsk: number;
  loserRuns: number;
}) {
  return x.loserRuns > 0 ? x.totalLossCashIsk / x.loserRuns : null;
}

export function formatRepeatOffenderDetails(x: {
  totalLossCashIsk: number;
  loserRuns: number;
  redRuns: number;
  runs: number;
  strategies: string[];
}) {
  const lrPct = (loserRate(x) * 100).toFixed(1);
  const rrPct = (redRate(x) * 100).toFixed(1);
  const avgLoss = avgLossPerLoserRun(x);
  const avgLossLabel = avgLoss !== null ? formatIsk(avgLoss) : "—";
  return `lossTotal=${formatIsk(x.totalLossCashIsk)} • loserRuns=${x.loserRuns} • redRuns=${x.redRuns} • runs=${x.runs} • strategies=${x.strategies.length} • loserRate=${lrPct}% • redRate=${rrPct}% • avgLoss/loser=${avgLossLabel}`;
}

export function buildBlacklistFromRepeatOffenders(
  offenders: Array<{
    destinationStationId: number;
    typeId: number;
    totalLossCashIsk: number;
    loserRuns: number;
    redRuns: number;
    runs: number;
  }>,
  opts: {
    minRuns: number;
    minLoserRatePct: number;
    minRedRatePct: number;
    mode: "OR" | "AND";
    maxItems: number;
  },
): {
  globalTypeIds: number[];
  byDestinationTypeIds: Record<string, number[]>;
} {
  const minRuns = Math.max(0, opts.minRuns || 0);
  const minLoserRate = Math.max(0, opts.minLoserRatePct || 0) / 100;
  const minRedRate = Math.max(0, opts.minRedRatePct || 0) / 100;
  const maxItems = Math.max(1, opts.maxItems || 1);

  const filtered = offenders
    .filter((x) => x.runs >= minRuns)
    .filter((x) => {
      const lr = loserRate(x);
      const rr = redRate(x);
      return opts.mode === "AND"
        ? lr >= minLoserRate && rr >= minRedRate
        : lr >= minLoserRate || rr >= minRedRate;
    })
    .sort((a, b) => a.totalLossCashIsk - b.totalLossCashIsk)
    .slice(0, maxItems);

  const byDestinationTypeIds: Record<string, number[]> = {};
  for (const x of filtered) {
    const key = String(x.destinationStationId);
    if (!byDestinationTypeIds[key]) byDestinationTypeIds[key] = [];
    if (!byDestinationTypeIds[key].includes(x.typeId)) {
      byDestinationTypeIds[key].push(x.typeId);
    }
  }
  for (const key of Object.keys(byDestinationTypeIds)) {
    byDestinationTypeIds[key].sort((a, b) => a - b);
  }

  return { globalTypeIds: [], byDestinationTypeIds };
}

export function avgP10Isk(
  rows: Array<{ profitP10Isk: number | null }> | undefined,
): number | null {
  if (!rows || rows.length === 0) return null;
  const vals = rows.map((r) => r.profitP10Isk).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
