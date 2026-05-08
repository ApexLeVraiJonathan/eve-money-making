export type MarketSide = "ALL" | "BUY" | "SELL";

export type MarketCronStatus = {
  appEnv: "dev" | "test" | "prod";
  jobsEnabled: boolean;
  jobEnabled: boolean;
  jobEnabledSourceKey: string | null;
  effectiveEnabled: boolean;
};

export type NpcMarketStatusResponse = {
  config: {
    enabled: boolean;
    stationId: number;
    pollMinutes: number;
    expiryWindowMinutes: number;
  };
  cron: MarketCronStatus;
  resolvedStation: null | {
    stationId: number;
    stationName: string;
    solarSystemId: number;
    solarSystemName: string;
    regionId: number;
  };
  latestSnapshot: null | {
    observedAt: string;
    orderCount: number;
    buyCount: number;
    sellCount: number;
    uniqueTypes: number;
  };
  latestAggregateDay: string | null;
  activeBaseline: null | {
    baselineId: string;
    observedAt: string;
    regionId: number;
  };
  lastRun: null | {
    baselineId: string;
    startedAt: string;
    finishedAt: string | null;
    ok: boolean;
    typeCount: number | null;
    errorMessage: string | null;
  };
};

export type NpcMarketOrder = {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

export type NpcMarketSnapshotLatestResponse = {
  stationId: number | null;
  baselineId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders: number;
  filteredOrders: number;
  typeNames?: Record<string, string>;
  orders: NpcMarketOrder[];
};

export type NpcMarketSnapshotTypeSummaryResponse = {
  stationId: number | null;
  baselineId: string | null;
  observedAt: string | null;
  side?: MarketSide;
  types: Array<{
    typeId: number;
    typeName: string | null;
    sellCount: number;
    buyCount: number;
    bestSell: number | null;
    bestBuy: number | null;
  }>;
};

export type NpcMarketDailyAggregatesResponse = {
  stationId: number | null;
  date: string | null;
  hasGone?: boolean;
  side?: MarketSide;
  typeNames?: Record<string, string>;
  rows: Array<{
    scanDate: string;
    stationId: number;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
    amount: string;
    orderNum: string;
    iskValue: string;
    high: string;
    low: string;
    avg: string;
  }>;
};

export type NpcMarketCollectResponse = {
  ok: true;
  stationId: number;
  regionId: number;
  baselineId: string;
  observedAt: string;
  typeCount: number;
  durationMs: number;
  aggregateKeys: number;
  hadPreviousBaseline: boolean;
};

export type NpcMarketCompareAdam4EveResponse = {
  station: {
    id: number;
    name: string | null;
  };
  range: {
    startDate: string | undefined;
    endDate: string | undefined;
  };
  side: MarketSide;
  summary: {
    npcRows: number;
    adamRows: number;
    unionKeys: number;
    missingNpc: number;
    missingAdam: number;
  };
  coverage: {
    successfulNpcRunsByDay: Record<string, number>;
  };
  diffs: Array<{
    key: string;
    scanDate: string;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
    npc: Record<string, string> | null;
    adam4eve: Record<string, string> | null;
    diff: {
      amount: string | null;
      orderNum: string | null;
      iskValue: string | null;
      absIskValue: string | null;
    };
  }>;
};

export type SelfMarketStatusResponse = {
  config: {
    enabled: boolean;
    structureId: string | null;
    characterId: number | null;
    pollMinutes: number;
    expiryWindowMinutes: number;
  };
  cron: MarketCronStatus;
  resolvedStructureId: string | null;
  latestSnapshot: null | {
    observedAt: string;
    orderCount: number;
    buyCount: number;
    sellCount: number;
    uniqueTypes: number;
  };
  latestAggregateDay: string | null;
};

export type SelfMarketOrder = {
  duration: number;
  is_buy_order: boolean;
  issued: string;
  location_id: number;
  min_volume: number;
  order_id: number;
  price: number;
  range: string;
  type_id: number;
  volume_remain: number;
  volume_total: number;
};

export type SelfMarketSnapshotLatestResponse = {
  structureId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders?: number;
  filteredOrders: number;
  typeTotalOrders?: number;
  typeNames?: Record<string, string>;
  orders: SelfMarketOrder[];
};

export type SelfMarketSnapshotTypeSummaryResponse = {
  structureId: string | null;
  observedAt: string | null;
  totalOrders: number;
  matchedOrders: number;
  uniqueTypes: number;
  types: Array<{
    typeId: number;
    typeName: string | null;
    sellCount: number;
    buyCount: number;
    bestSell: number | null;
    bestBuy: number | null;
  }>;
};

export type SelfMarketDailyAggregatesResponse = {
  structureId: string | null;
  date: string | null;
  hasGone?: boolean;
  side?: MarketSide;
  typeNames?: Record<string, string>;
  rows: Array<{
    scanDate: string;
    locationId: string;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
    amount: string;
    orderNum: string;
    iskValue: string;
    high: string;
    low: string;
    avg: string;
  }>;
};

export type SelfMarketCollectResponse = {
  ok: true;
  observedAt: string;
  orderCount: number;
  tradesKeys: number;
};

export type SelfMarketClearDailyResponse =
  | {
      ok: true;
      deleted: number;
      date: string;
      structureId: string;
    }
  | { ok: false; error: string };

export type MarketDataSpaceReportResponse = {
  generatedAt: string;
  tables: Array<{
    tableName: string;
    label: string;
    category:
      | "raw-npc"
      | "snapshot-latest"
      | "run-metadata"
      | "baseline"
      | "daily-aggregate"
      | "anomaly"
      | "supporting";
    retentionPolicy: "short-lived" | "latest-only" | "indefinite" | "planned";
    exists: boolean;
    rowCountEstimate: string | null;
    rowCountIsEstimate: boolean;
    tableBytes: string | null;
    indexBytes: string | null;
    totalBytes: string | null;
    oldestRecordAt: string | null;
    newestRecordAt: string | null;
    timestampColumn: string | null;
    notes: string | null;
  }>;
  totals: {
    tableBytes: string;
    indexBytes: string;
    totalBytes: string;
    existingTableCount: number;
    missingTableCount: number;
  };
};

export type MarketDataCleanupResponse = {
  ok: true;
  skipped: boolean;
  reason: string | null;
  retentionDays: number;
  cutoff: string;
  protectedBaselineIds: string[];
  deleted: {
    npcMarketSnapshots: number;
    npcMarketRegionTypesSnapshots: number;
    npcMarketRuns: number;
  };
};

export type MarketDataHealthResponse = {
  generatedAt: string;
  range: {
    startDate: string;
    endDate: string;
  };
  sources: Array<{
    source: "npc" | "self";
    label: string;
    status: "healthy" | "watch" | "missing";
    expectedDays: number;
    daysWithData: number;
    missingDays: string[];
    successfulRuns: number | null;
    failedRuns: number | null;
    latestObservedAt: string | null;
    warnings: string[];
    days: Array<{
      date: string;
      successfulRuns: number | null;
      failedRuns: number | null;
      aggregateRows: number;
      totalIskValue: string;
      warning: string | null;
    }>;
  }>;
};

export type MarketDataAnomaliesResponse = {
  generatedAt: string;
  retentionDays: number;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byAction: Record<string, number>;
  };
  examples: Array<{
    id: string;
    source: "npc" | "self";
    locationId: string;
    typeId: number;
    isBuyOrder: boolean;
    observedPrice: string;
    observedVolume: string;
    referencePrice: string | null;
    thresholdLow: string | null;
    thresholdHigh: string | null;
    severity: string;
    action: string;
    reasonCode: string;
    referenceSource: string | null;
    scanObservedAt: string;
    createdAt: string;
  }>;
};

export type MarketDataReadinessResponse = {
  generatedAt: string;
  status: "not-ready" | "watch" | "ready-candidate";
  label: string;
  validationWindow: {
    requiredDays: number;
    validationStartDate: string;
    eligibleOn: string;
    evaluatedStartDate: string;
    evaluatedEndDate: string;
    elapsedDays: number;
  };
  reasons: string[];
  checks: {
    newSignalGate: {
      ok: boolean;
      detail: string;
    };
    scanHealth: {
      ok: boolean;
      npcStatus: "healthy" | "watch" | "missing";
      selfStatus: "healthy" | "watch" | "missing";
      warnings: string[];
    };
    adam4eveReference: {
      ok: boolean;
      stationId: number;
      npcRows: number;
      adamRows: number;
      unionKeys: number;
      missingNpc: number;
      missingAdam: number;
      missingNpcRatio: number;
      note: string;
    };
    anomalies: {
      ok: boolean;
      severe: number;
      borderline: number;
      total: number;
    };
  };
};

export type TrackedStation = {
  id: string;
  stationId: number;
  station: {
    id: number;
    name: string;
  };
  createdAt: string;
};

export type {
  CommittedPackage,
} from "./types/market-arbitrage.js";

export type {
  JingleYieldProgramSummary,
  JingleYieldStatus,
} from "./types/participations.js";
