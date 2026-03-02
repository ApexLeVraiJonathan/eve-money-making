import { formatIsk } from "@/lib/utils";

export const DEFAULT_STRATEGY_PARAMS = {
  shippingCostByStation: {
    "60004588": 20000000,
    "60005686": 15000000,
    "60008494": 25000000,
    "60011866": 15000000,
  },
  packageCapacityM3: 13000,
  investmentISK: 50000000000,
  perDestinationMaxBudgetSharePerItem: 0.15,
  maxPackagesHint: 100,
  maxPackageCollateralISK: 4000000000,
  allocation: { mode: "best" as const },
  liquidityOptions: { windowDays: 14 },
  arbitrageOptions: {
    maxInventoryDays: 3,
    minMarginPercent: 10,
  },
};

export type AnyRecord = Record<string, unknown>;

export function isPlainObject(v: unknown): v is AnyRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) return override ?? base;
  const out: AnyRecord = { ...base };
  for (const [k, value] of Object.entries(override)) {
    out[k] = deepMerge((base as AnyRecord)[k], value);
  }
  return out;
}

export function formatPercentFromShare(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

export function formatNumberLike(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return "—";
}

export function formatIskMaybe(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "—";
  return formatIsk(n);
}

export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}
