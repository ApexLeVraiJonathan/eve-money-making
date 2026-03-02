type RunSummary = {
  totalProfitIsk?: number;
  roiPercent?: number | null;
  maxDrawdownPct?: number;
  days?: number;
};

export function parseRunSummary(summary: unknown): RunSummary {
  if (!summary || typeof summary !== "object") return {};
  const s = summary as Record<string, unknown>;

  const num = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Number(v);
    }
    return undefined;
  };

  const roi = s.roiPercent;
  const roiNum =
    roi === null
      ? null
      : typeof roi === "number" && Number.isFinite(roi)
        ? roi
        : typeof roi === "string" && roi.trim() !== "" && Number.isFinite(Number(roi))
          ? Number(roi)
          : undefined;

  return {
    totalProfitIsk: num(s.totalProfitIsk),
    roiPercent: roiNum,
    maxDrawdownPct: num(s.maxDrawdownPct),
    days: num(s.days),
  };
}
