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
} from "./types/market-arbitrage";

export type {
  JingleYieldProgramSummary,
  JingleYieldStatus,
} from "./types/participations";
