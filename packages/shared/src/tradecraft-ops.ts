export type MarketStaleness = {
  stations: Array<{
    stationId: number;
    stationName: string;
    lastUpdate: string | null;
    ageHours: number | null;
    isStale: boolean;
  }>;
  overallStaleness: {
    avgAgeHours: number;
    maxAgeHours: number;
    staleCount: number;
    totalCount: number;
  };
};

export type JobStatusResponse = {
  lastRun: string | null;
  isRunning: boolean;
  nextRun: string | null;
};

export type CleanupJobResponse = {
  cleaned: number;
};

export type WalletsJobRunResponse = {
  ok: boolean;
  buysAllocated: number;
  sellsAllocated: number;
};

export type EsiMetrics = {
  cacheHitMem: number;
  cacheHitDb: number;
  cacheMiss: number;
  http200: number;
  http304: number;
  http401: number;
  http420: number;
  memCacheSize: number;
  inflightSize: number;
  effectiveMaxConcurrency: number;
  errorRemain: number | null;
  errorResetAt: number | null;
};

export type OkResponse = {
  ok: boolean;
};

export type MessageResponse = {
  message?: string;
};
