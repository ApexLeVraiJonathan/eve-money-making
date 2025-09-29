export type LiquidityItemDto = {
  typeId: number;
  typeName?: string;
  avgDailyAmount: number;
  latest: { high: string; low: string; avg: string } | null;
  avgDailyIskValue: number;
  coverageDays: number;
};
