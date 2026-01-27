export type FeeDefaults = {
  salesTaxPercent: number;
  brokerFeePercent: number;
  relistFeePercent: number;
};

export type ArbitrageDefaults = {
  sourceStationId: number;
  maxInventoryDays: number;
  marginValidateThreshold: number;
  minTotalProfitISK: number;
  minMarginPercent: number;
  stationConcurrency: number;
  itemConcurrency: number;
  fees: FeeDefaults;
};

export type JwtConfig = {
  secret: string;
  expiresIn: string;
};

export type CorsConfig = {
  origins: string[];
};

export type EsiConfig = {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  maxConcurrency: number;
  minConcurrency: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  errorSlowdownRemainThreshold: number;
  errorSlowdownDelayMs: number;
  concurrencyDecayFactor: number;
  errorLogThrottleMs: number;
  memCacheMax: number;
  memCacheSweepMs: number;
};

export type DiscordOauthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type MarketSelfGatherConfig = {
  enabled: boolean;
  structureId: bigint | null;
  characterId: number | null;
  pollMinutes: number;
  expiryWindowMinutes: number;
  notifyUserId: string | null;
};

export type MarketNpcGatherConfig = {
  enabled: boolean;
  /// Default NPC stationId to collect (used when none is provided)
  stationId: number;
  /// Polling interval in minutes (used once cron is enabled)
  pollMinutes: number;
  /// Expiry heuristic window for disappeared orders (upper-bound mode)
  expiryWindowMinutes: number;
  /// Optional user to notify (system alert DM) on repeated failures
  notifyUserId: string | null;
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
   * Server port
   */
  port(): number {
    return Number(process.env.PORT ?? 3000);
  },

  /**
   * Discord OAuth configuration (for user account linking)
   */
  discordOauth(): DiscordOauthConfig {
    const clientId = process.env.DISCORD_CLIENT_ID ?? '';
    const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? '';
    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ??
      new URL(
        '/notifications/discord/callback',
        AppConfig.apiBaseUrl(),
      ).toString();

    if (!clientId || !clientSecret) {
      // Intentionally do not throw here – feature is optional and guarded elsewhere
      return { clientId, clientSecret, redirectUri };
    }

    return { clientId, clientSecret, redirectUri };
  },

  /**
   * Discord bot token used for DM notifications
   */
  discordBotToken(): string | null {
    const token = process.env.DISCORD_BOT_TOKEN ?? null;
    return token && token.trim().length > 0 ? token : null;
  },

  /**
   * API base URL (for constructing callback URLs)
   */
  apiBaseUrl(): string {
    return process.env.API_BASE_URL || 'http://localhost:3000';
  },

  /**
   * Web app base URL
   */
  webBaseUrl(): string {
    return (
      process.env.WEB_BASE_URL ||
      process.env.NEXT_PUBLIC_WEB_BASE_URL ||
      'http://localhost:3001'
    );
  },

  /**
   * NextAuth URL (for CORS and redirects)
   */
  nextAuthUrl(): string {
    return process.env.NEXTAUTH_URL || 'http://localhost:3001';
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
   * Encryption key for sensitive data
   */
  encryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY ?? '';
    if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
    return key;
  },

  /**
   * JWT configuration
   */
  jwt(): JwtConfig {
    return {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  },

  /**
   * CORS configuration
   */
  cors(): CorsConfig {
    const origins = [
      'http://localhost:3000',
      'http://localhost:3001',
      AppConfig.nextAuthUrl(),
    ].filter(Boolean);

    // Add custom origins if specified
    const customOrigins = process.env.CORS_ORIGINS;
    if (customOrigins) {
      origins.push(...customOrigins.split(',').map((o) => o.trim()));
    }

    return {
      origins: Array.from(new Set(origins)), // Remove duplicates
    };
  },

  /**
   * ESI API configuration
   */
  esi(): EsiConfig {
    return {
      baseUrl: process.env.ESI_BASE_URL || 'https://esi.evetech.net',
      userAgent:
        process.env.ESI_USER_AGENT || process.env.ESI_SSO_USER_AGENT || '',
      timeoutMs: Number(process.env.ESI_TIMEOUT_MS ?? 15000),
      maxConcurrency: Number(process.env.ESI_MAX_CONCURRENCY ?? 4),
      minConcurrency: Number(process.env.ESI_MIN_CONCURRENCY ?? 2),
      maxRetries: Number(process.env.ESI_MAX_RETRIES ?? 3),
      retryBaseDelayMs: Number(process.env.ESI_RETRY_BASE_DELAY_MS ?? 400),
      errorSlowdownRemainThreshold: Number(
        process.env.ESI_ERROR_SLOWDOWN_REMAIN_THRESHOLD ?? 5,
      ),
      errorSlowdownDelayMs: Number(
        process.env.ESI_ERROR_SLOWDOWN_DELAY_MS ?? 500,
      ),
      concurrencyDecayFactor: Number(process.env.ESI_CONCURRENCY_DECAY ?? 0.5),
      errorLogThrottleMs: Number(process.env.ESI_ERROR_LOG_THROTTLE_MS ?? 5000),
      memCacheMax: Number(process.env.ESI_MEM_CACHE_MAX ?? 5000),
      memCacheSweepMs: Number(process.env.ESI_MEM_CACHE_SWEEP_MS ?? 300_000),
    };
  },

  /**
   * ESI SSO scopes configuration
   */
  esiScopes() {
    const parse = (value: string | undefined | null) =>
      (value ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const defaultScopes = parse(process.env.ESI_SSO_SCOPES ?? '');
    const adminScopes = parse(
      process.env.ESI_SSO_SCOPES_ADMIN ?? process.env.ESI_SSO_SCOPES ?? '',
    );
    const userScopes = parse(process.env.ESI_SSO_SCOPES_USER ?? '');
    const systemScopes = parse(process.env.ESI_SSO_SCOPES_SYSTEM ?? '');

    // New per-flow helpers – prefer dedicated envs, fall back to existing ones
    const loginScopes = parse(
      process.env.ESI_SSO_SCOPES_LOGIN ??
        process.env.ESI_SSO_SCOPES_USER ??
        process.env.ESI_SSO_SCOPES ??
        '',
    );
    const characterScopes = parse(
      process.env.ESI_SSO_SCOPES_CHARACTER ??
        process.env.ESI_SSO_SCOPES_USER ??
        '',
    );

    return {
      // Backwards-compatible fields
      default: defaultScopes,
      admin: adminScopes,
      user: userScopes,
      system: systemScopes,
      // New, clearer fields
      login: loginScopes,
      character: characterScopes,
    };
  },

  /**
   * Self-gathered market data collection (structure market polling).
   */
  marketSelfGather(): MarketSelfGatherConfig {
    const enabled =
      (process.env.MARKET_SELF_GATHER_ENABLED ?? '').toLowerCase() === 'true' ||
      process.env.MARKET_SELF_GATHER_ENABLED === '1' ||
      process.env.MARKET_SELF_GATHER_ENABLED === 'yes';

    const structureIdRaw = process.env.MARKET_SELF_GATHER_STRUCTURE_ID ?? '';
    const structureId =
      structureIdRaw && structureIdRaw.trim().length > 0
        ? BigInt(structureIdRaw)
        : null;

    const characterIdRaw = process.env.MARKET_SELF_GATHER_CHARACTER_ID ?? '';
    const characterId =
      characterIdRaw && characterIdRaw.trim().length > 0
        ? Number(characterIdRaw)
        : null;

    // Defaults (overridable via env). This makes deployments/dev environments
    // "just work" for the primary alliance hub without extra configuration.
    const effectiveStructureId = structureId ?? 1045667241057n;
    const effectiveCharacterId = characterId ?? 2122151042;

    const pollMinutes = Number(
      process.env.MARKET_SELF_GATHER_POLL_MINUTES ?? 10,
    );
    const expiryWindowMinutes = Number(
      process.env.MARKET_SELF_GATHER_EXPIRY_WINDOW_MINUTES ?? 360,
    );

    const notifyUserIdRaw = process.env.MARKET_SELF_GATHER_NOTIFY_USER_ID ?? '';
    const notifyUserId =
      notifyUserIdRaw && notifyUserIdRaw.trim().length > 0
        ? notifyUserIdRaw.trim()
        : null;

    return {
      enabled,
      structureId: effectiveStructureId,
      characterId: effectiveCharacterId,
      pollMinutes:
        Number.isFinite(pollMinutes) && pollMinutes > 0 ? pollMinutes : 10,
      expiryWindowMinutes:
        Number.isFinite(expiryWindowMinutes) && expiryWindowMinutes >= 0
          ? expiryWindowMinutes
          : 360,
      notifyUserId,
    };
  },

  /**
   * Self-gathered market data collection for NPC stations (regional orders).
   *
   * Manual-first: cron wiring comes later once runtime is validated.
   */
  marketNpcGather(): MarketNpcGatherConfig {
    const enabled =
      (process.env.MARKET_NPC_GATHER_ENABLED ?? '').toLowerCase() === 'true' ||
      process.env.MARKET_NPC_GATHER_ENABLED === '1' ||
      process.env.MARKET_NPC_GATHER_ENABLED === 'yes';

    const stationIdRaw = process.env.MARKET_NPC_GATHER_STATION_ID ?? '';
    const stationId =
      stationIdRaw && stationIdRaw.trim().length > 0
        ? Number(stationIdRaw)
        : 60004588; // Rens VI - Moon 8 - Brutor Tribe Treasury

    const pollMinutes = Number(
      process.env.MARKET_NPC_GATHER_POLL_MINUTES ?? 15,
    );
    const expiryWindowMinutes = Number(
      process.env.MARKET_NPC_GATHER_EXPIRY_WINDOW_MINUTES ?? 360,
    );

    const notifyUserIdRaw = process.env.MARKET_NPC_GATHER_NOTIFY_USER_ID ?? '';
    const notifyUserId =
      notifyUserIdRaw && notifyUserIdRaw.trim().length > 0
        ? notifyUserIdRaw.trim()
        : null;

    return {
      enabled,
      stationId:
        Number.isFinite(stationId) && stationId > 0 ? stationId : 60004588,
      pollMinutes:
        Number.isFinite(pollMinutes) && pollMinutes > 0 ? pollMinutes : 15,
      expiryWindowMinutes:
        Number.isFinite(expiryWindowMinutes) && expiryWindowMinutes >= 0
          ? expiryWindowMinutes
          : 360,
      notifyUserId,
    };
  },

  /**
   * ESI SSO return URL allowlist
   */
  esiReturnUrlAllowlist(): string[] {
    const allowFromEnv = (
      process.env.ESI_SSO_RETURN_URL_ALLOWLIST ||
      'http://localhost:3001,http://127.0.0.1:3001'
    )
      .split(',')
      .map((o) => o.trim());

    const extraOrigins: string[] = [];
    for (const v of [
      process.env.WEB_BASE_URL,
      process.env.NEXT_PUBLIC_WEB_BASE_URL,
    ]) {
      if (v) extraOrigins.push(v);
    }

    return Array.from(new Set([...allowFromEnv, ...extraOrigins]));
  },

  /**
   * ESI SSO default return URL
   */
  esiDefaultReturnUrl(): string | null {
    const url = process.env.ESI_SSO_DEFAULT_RETURN_URL;
    if (!url) return null;
    try {
      return new URL(url).toString();
    } catch {
      return null;
    }
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

  /**
   * ESI SSO credentials for character linking (App 2).
   * Used for USER-managed characters linked via /auth/link-character/*.
   */
  esiSsoLinking() {
    const base = AppConfig.esiSso();
    return {
      clientId: base.clientId,
      clientSecret: base.clientSecret,
      // Use the unified callback URL; routing is handled by state in the callback handler.
      redirectUri: base.redirectUri,
      userAgent: base.userAgent,
    } as const;
  },

  /**
   * ESI SSO credentials for SYSTEM characters (App 3).
   * Used for SYSTEM-managed characters (managedBy=SYSTEM, role=LOGISTICS).
   */
  esiSsoSystem() {
    const base = AppConfig.esiSso();
    return {
      clientId: base.clientId,
      clientSecret: base.clientSecret,
      // Use the unified callback URL; routing is handled by state in the callback handler.
      redirectUri: base.redirectUri,
      userAgent: base.userAgent,
    } as const;
  },

  /**
   * Legacy ESI token credentials (App 1)
   * @deprecated Use esiSso(), esiSsoLinking(), or esiSsoSystem() instead
   */
  esiTokenLegacy() {
    return {
      clientId: process.env.EVE_CLIENT_ID ?? '',
      clientSecret: process.env.EVE_CLIENT_SECRET ?? '',
    } as const;
  },

  /**
   * Jobs/background tasks configuration
   */
  jobs() {
    const flag = process.env.ENABLE_JOBS;
    let enabled: boolean;
    if (flag !== undefined) {
      enabled = flag === 'true' || flag === '1' || flag === 'yes';
    } else {
      enabled = process.env.NODE_ENV === 'production';
    }
    return {
      enabled,
    } as const;
  },

  /**
   * Arbitrage calculation defaults
   */
  arbitrage(): ArbitrageDefaults {
    return {
      sourceStationId: Number(
        process.env.DEFAULT_SOURCE_STATION_ID ?? 60003760,
      ),
      maxInventoryDays: Number(process.env.DEFAULT_MAX_INVENTORY_DAYS ?? 3),
      marginValidateThreshold: Number(
        process.env.DEFAULT_MARGIN_VALIDATE_THRESHOLD ?? 50,
      ),
      minTotalProfitISK: Number(
        process.env.DEFAULT_MIN_TOTAL_PROFIT_ISK ?? 1_000_000,
      ),
      minMarginPercent: Number(process.env.DEFAULT_MIN_MARGIN_PERCENT ?? 10),
      stationConcurrency: Number(process.env.DEFAULT_STATION_CONCURRENCY ?? 4),
      itemConcurrency: Number(process.env.DEFAULT_ITEM_CONCURRENCY ?? 20),
      fees: {
        salesTaxPercent: Number(process.env.DEFAULT_SALES_TAX_PCT ?? 3.37),
        brokerFeePercent: Number(process.env.DEFAULT_BROKER_FEE_PCT ?? 1.5),
        relistFeePercent: Number(process.env.DEFAULT_RELIST_FEE_PCT ?? 0.3),
      },
    };
  },
  /**
   * Discord guild (server) ID for auto-joining users
   */
  discordGuildId(): string | null {
    const guildId = process.env.DISCORD_GUILD_ID ?? '';
    const trimmed = guildId.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
} as const;
