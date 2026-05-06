import { AppConfig } from '@api/common/config';

export type JobKey = {
  /**
   * Human-readable identifier (used for logging).
   */
  id: string;
  /**
   * Primary env key to control this job.
   * If unset, defaults to enabled (true).
   */
  envKey: string;
  /**
   * Optional legacy env keys still honored if envKey is unset.
   */
  legacyEnvKeys?: ReadonlyArray<string>;
};

export function resolveJobEnabledFlag(job: JobKey): {
  enabled: boolean;
  sourceKey: string | null;
} {
  const rawPrimary = process.env[job.envKey];
  if (rawPrimary !== undefined) {
    return { enabled: AppConfig.boolEnv(rawPrimary), sourceKey: job.envKey };
  }
  for (const legacyKey of job.legacyEnvKeys ?? []) {
    const rawLegacy = process.env[legacyKey];
    if (rawLegacy !== undefined) {
      return { enabled: AppConfig.boolEnv(rawLegacy), sourceKey: legacyKey };
    }
  }
  return { enabled: true, sourceKey: null };
}

export const JobKeys = {
  esiCacheCleanup: {
    id: 'esiCacheCleanup',
    envKey: 'JOB_ESI_CACHE_CLEANUP_ENABLED',
    legacyEnvKeys: ['JOB_CLEANUP_ENABLED'],
  },
  oauthStateCleanup: {
    id: 'oauthStateCleanup',
    envKey: 'JOB_OAUTH_STATE_CLEANUP_ENABLED',
    legacyEnvKeys: ['JOB_CLEANUP_ENABLED'],
  },
  dailyImports: {
    id: 'dailyImports',
    envKey: 'JOB_DAILY_IMPORTS_ENABLED',
  },
  marketGathering: {
    id: 'marketGathering',
    envKey: 'JOB_MARKET_GATHERING_ENABLED',
    legacyEnvKeys: ['JOB_MARKET_GATHER_ENABLED'],
  },
  expiryNotifications: {
    id: 'expiryNotifications',
    envKey: 'JOB_EXPIRY_NOTIFICATIONS_ENABLED',
  },
  walletImports: {
    id: 'walletImports',
    envKey: 'JOB_WALLET_IMPORTS_ENABLED',
    legacyEnvKeys: ['JOB_WALLETS_ENABLED'],
  },
  capitalRecompute: {
    id: 'capitalRecompute',
    envKey: 'JOB_CAPITAL_RECOMPUTE_ENABLED',
    legacyEnvKeys: ['JOB_CAPITAL_ENABLED'],
  },
  systemTokensRefresh: {
    id: 'systemTokensRefresh',
    envKey: 'JOB_SYSTEM_TOKENS_REFRESH_ENABLED',
    legacyEnvKeys: ['JOB_SYSTEM_TOKENS_ENABLED'],
  },
  scriptRunWatchdog: {
    id: 'scriptRunWatchdog',
    envKey: 'JOB_SCRIPT_RUN_WATCHDOG_ENABLED',
  },
} as const satisfies Record<string, JobKey>;
