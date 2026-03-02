import type {
  CycleLinesIntelRow,
  CycleLinesIntelTotals,
} from "@eve/shared/tradecraft-cycles";

export type IntelBucket = {
  rows: CycleLinesIntelRow[];
  totals: CycleLinesIntelTotals;
};

export type IntelBlockData = {
  profitable: IntelBucket;
  potential: IntelBucket;
  red: IntelBucket;
};

export type DestinationIntel = {
  destinationStationId: number;
  destinationStationName: string;
  profitable: IntelBucket;
  potential: IntelBucket;
  red: IntelBucket;
};
