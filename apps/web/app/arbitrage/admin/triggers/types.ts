export type TriggerState = {
  [key: string]: boolean;
};

export type TrackedStation = {
  id: string;
  stationId: number;
  station: {
    id: number;
    name: string;
  };
};

export type ImportSummary = {
  typeIds: number;
  regionIds: number;
  solarSystemIds: number;
  npcStationIds: number;
};

export type MarketStaleness = {
  missing: string[];
  results?: Record<string, unknown>;
};

export type MatchResult = {
  matched: number;
  partial: number;
  unmatched: Array<{
    journalId: string;
    characterId: number;
    amount: string;
    description: string | null;
    date: string;
  }>;
};

export type CycleSnapshot = {
  id: string;
  cycleId: string;
  walletCashIsk: string;
  inventoryIsk: string;
  cycleProfitIsk: string;
  snapshotAt: string;
};
