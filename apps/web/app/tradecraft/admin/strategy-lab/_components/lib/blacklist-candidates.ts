import type { AutoBlacklistCandidate } from "./types";

export const AUTO_BLACKLIST_CANDIDATES: AutoBlacklistCandidate[] = [
  {
    label: "Strict (runs>=30, 30%/30%, OR, max 10)",
    opts: {
      minRuns: 30,
      minLoserRatePct: 30,
      minRedRatePct: 30,
      mode: "OR",
      maxItems: 10,
    },
  },
  {
    label: "Strict+ (runs>=30, 25%/25%, OR, max 15)",
    opts: {
      minRuns: 30,
      minLoserRatePct: 25,
      minRedRatePct: 25,
      mode: "OR",
      maxItems: 15,
    },
  },
  {
    label: "Balanced (runs>=20, 25%/25%, OR, max 25)",
    opts: {
      minRuns: 20,
      minLoserRatePct: 25,
      minRedRatePct: 25,
      mode: "OR",
      maxItems: 25,
    },
  },
  {
    label: "Balanced+ (runs>=20, 20%/20%, OR, max 35)",
    opts: {
      minRuns: 20,
      minLoserRatePct: 20,
      minRedRatePct: 20,
      mode: "OR",
      maxItems: 35,
    },
  },
  {
    label: "AND filter (runs>=20, 20%/20%, AND, max 25)",
    opts: {
      minRuns: 20,
      minLoserRatePct: 20,
      minRedRatePct: 20,
      mode: "AND",
      maxItems: 25,
    },
  },
  {
    label: "Wide (runs>=15, 20%/20%, OR, max 50)",
    opts: {
      minRuns: 15,
      minLoserRatePct: 20,
      minRedRatePct: 20,
      mode: "OR",
      maxItems: 50,
    },
  },
];
