export type FeeDefaults = {
  salesTaxPercent: number;
  brokerFeePercent: number;
};

export type ArbitrageDefaults = {
  sourceStationId: number;
  multiplier: number;
  marginValidateThreshold: number;
  minTotalProfitISK: number;
  stationConcurrency: number;
  itemConcurrency: number;
  fees: FeeDefaults;
};

export const AppConfig = {
  arbitrage(): ArbitrageDefaults {
    return {
      sourceStationId: Number(
        process.env.DEFAULT_SOURCE_STATION_ID ?? 60003760,
      ),
      multiplier: Number(process.env.DEFAULT_ARBITRAGE_MULTIPLIER ?? 3),
      marginValidateThreshold: Number(
        process.env.DEFAULT_MARGIN_VALIDATE_THRESHOLD ?? 50,
      ),
      minTotalProfitISK: Number(
        process.env.DEFAULT_MIN_TOTAL_PROFIT_ISK ?? 1_000_000,
      ),
      stationConcurrency: Number(process.env.DEFAULT_STATION_CONCURRENCY ?? 4),
      itemConcurrency: Number(process.env.DEFAULT_ITEM_CONCURRENCY ?? 20),
      fees: {
        salesTaxPercent: Number(process.env.DEFAULT_SALES_TAX_PCT ?? 3.37),
        brokerFeePercent: Number(process.env.DEFAULT_BROKER_FEE_PCT ?? 1.5),
      },
    };
  },
} as const;
