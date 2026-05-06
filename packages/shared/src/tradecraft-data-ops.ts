export type WalletTransactionRow = {
  characterId: number;
  characterName: string | null;
  transactionId: string;
  date: string;
  isBuy: boolean;
  locationId: string;
  stationName: string | null;
  typeId: number;
  typeName: string | null;
  quantity: number;
  unitPrice: string;
};

export type WalletImportAllResponse = {
  imported: number;
  skipped: number;
  charactersProcessed: number;
};

export type WalletReconcileResponse = {
  buysAllocated: number;
  sellsAllocated: number;
  unmatchedBuys: number;
  unmatchedSells: number;
};

export type GameDataImportSummary = {
  types: number;
  stations: number;
  systems: number;
  regions: number;
  lastImport: string | null;
};

export type GameDataImportSummaryResponse = {
  typeIds: number;
  regionIds: number;
  solarSystemIds: number;
  npcStationIds: number;
};

export type GameDataImportResult = {
  imported: number;
  updated: number;
  failed: number;
};

export type GameDataImportAllResult = {
  types: { imported: number; updated: number };
  stations: { imported: number; updated: number };
  systems: { imported: number; updated: number };
  regions: { imported: number; updated: number };
};

export type GameDataImportCountResult = {
  imported: number;
};

export interface ImportMarketTradesDaySuccess {
  ok: true;
  inserted: number;
  skipped: number;
  totalRows: number;
  batchSize: number;
}

export type ImportMarketTradesErrorStage = "initial" | "retryAfterTypeIds";

export interface ImportMarketTradesDayError {
  ok: false;
  error: string;
  stage: ImportMarketTradesErrorStage;
}

export type ImportMarketTradesDayResult =
  | ImportMarketTradesDaySuccess
  | ImportMarketTradesDayError;

export interface ImportMissingMarketTradesResponse {
  missing: string[];
  results: Record<string, ImportMarketTradesDayResult>;
}
