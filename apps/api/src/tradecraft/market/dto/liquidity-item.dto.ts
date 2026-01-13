export type LiquidityItemDto = {
  typeId: number;
  typeName?: string;
  /** Optional: type volume in m3 (when available) */
  volumeM3?: number;
  avgDailyAmount: number;
  latest: { high: string; low: string; avg: string } | null;
  avgDailyIskValue: number;
  coverageDays: number;
  avgDailyTrades: number;
};
