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
  /**
   * Resolve application environment. Accepts APP_ENV (dev|test|prod) or falls back to NODE_ENV.
   */
  env(): 'dev' | 'test' | 'prod' {
    const appEnv = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'prod')
      .toString()
      .toLowerCase();
    if (appEnv.startsWith('dev')) return 'dev';
    if (appEnv.startsWith('test')) return 'test';
    return 'prod';
  },

  /**
   * Database URL selected by APP_ENV.
   */
  databaseUrl(): string | undefined {
    const env = AppConfig.env();
    if (env === 'dev')
      return process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL;
    if (env === 'test')
      return (
        process.env.DATABASE_URL_TEST ??
        process.env.DATABASE_URL_DEV ??
        process.env.DATABASE_URL
      );
    return process.env.DATABASE_URL;
  },

  /**
   * ESI SSO credentials selected by APP_ENV.
   * Note: Do not expose secrets to client code.
   */
  esiSso() {
    const env = AppConfig.env();
    if (env === 'dev' || env === 'test') {
      return {
        clientId:
          process.env.ESI_CLIENT_ID_DEV ?? process.env.ESI_SSO_CLIENT_ID ?? '',
        clientSecret:
          process.env.ESI_CLIENT_SECRET_DEV ??
          process.env.ESI_SSO_CLIENT_SECRET ??
          '',
        redirectUri:
          process.env.ESI_REDIRECT_URI_DEV ??
          process.env.ESI_SSO_REDIRECT_URI ??
          '',
        userAgent:
          process.env.ESI_USER_AGENT ?? process.env.ESI_SSO_USER_AGENT ?? '',
      } as const;
    }
    return {
      clientId: process.env.ESI_SSO_CLIENT_ID ?? '',
      clientSecret: process.env.ESI_SSO_CLIENT_SECRET ?? '',
      redirectUri: process.env.ESI_SSO_REDIRECT_URI ?? '',
      userAgent:
        process.env.ESI_SSO_USER_AGENT ?? process.env.ESI_USER_AGENT ?? '',
    } as const;
  },

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
