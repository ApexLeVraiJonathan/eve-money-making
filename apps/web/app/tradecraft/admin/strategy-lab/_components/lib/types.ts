export type ShippingRow = { stationId: string; costIsk: string };

export type BlacklistAutoBest = {
  label: string;
  baselineAvgP10Isk: number | null;
  bestAvgP10Isk: number | null;
  avgDeltaP10Isk: number | null;
  blacklistJson: string;
};

export type AutoBlacklistCandidate = {
  label: string;
  opts: {
    minRuns: number;
    minLoserRatePct: number;
    minRedRatePct: number;
    mode: "OR" | "AND";
    maxItems: number;
  };
};
