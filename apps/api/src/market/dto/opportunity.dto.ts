export type PriceValidationSource = 'ESI' | 'LiquidityAvg' | 'None';

export type Opportunity = {
  typeId: number;
  name: string;
  sourceStationId: number;
  destinationStationId: number;
  sourcePrice: number | null;
  destinationPrice: number | null;
  priceValidationSource: PriceValidationSource;
  netProfitISK: number; // per-unit
  margin: number; // percent, e.g., 120 for +20%
  recentDailyVolume: number;
  arbitrageQuantity: number;
  totalCostISK: number;
  totalProfitISK: number;
};

export type DestinationGroup = {
  destinationStationId: number;
  stationName?: string;
  totalItems: number;
  totalCostISK: number;
  totalProfitISK: number;
  averageMargin: number;
  items: Opportunity[];
};
