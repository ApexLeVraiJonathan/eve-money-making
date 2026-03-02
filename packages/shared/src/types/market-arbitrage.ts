export interface LiquidityCheckRequest {
  station_id?: number;
  windowDays?: number;
  minCoverageRatio?: number;
  minLiquidityThresholdISK?: number;
  minWindowTrades?: number;
}

export interface LiquidityItemDto {
  typeId: number;
  typeName?: string;
  avgDailyAmount: number;
  latest: { high: string; low: string; avg: string } | null;
  avgDailyIskValue: number;
  coverageDays: number;
  avgDailyTrades: number;
}

export interface LiquidityCheckResponse {
  [stationId: string]: {
    stationName: string;
    totalItems: number;
    items: LiquidityItemDto[];
  };
}

export interface LiquidityItemStatsRequest {
  itemId?: number;
  itemName?: string;
  stationId?: number;
  stationName?: string;
  isBuyOrder?: boolean;
  windowDays?: number;
}

export interface LiquidityItemStatsResponse {
  [stationId: string]: {
    stationName: string;
    buy?: {
      perDay: Array<{
        date: string;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>;
      windowAverages: { amountAvg: number; iskValueAvg: number };
    };
    sell?: {
      perDay: Array<{
        date: string;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>;
      windowAverages: { amountAvg: number; iskValueAvg: number };
    };
  };
}

export type PriceValidationSource = "ESI" | "LiquidityAvg" | "None";

export interface ArbitrageCheckRequest {
  sourceStationId?: number;
  maxInventoryDays?: number;
  marginValidateThreshold?: number;
  minTotalProfitISK?: number;
  minMarginPercent?: number;
  maxPriceDeviationMultiple?: number;
  stationConcurrency?: number;
  itemConcurrency?: number;
  salesTaxPercent?: number;
  brokerFeePercent?: number;
  esiMaxConcurrency?: number;
  liquidityWindowDays?: number;
  liquidityMinCoverageRatio?: number;
  liquidityMinLiquidityThresholdISK?: number;
  liquidityMinWindowTrades?: number;
  destinationStationIds?: number[];
  excludeDestinationStationIds?: number[];
  disableInventoryLimit?: boolean;
  allowInventoryTopOff?: boolean;
}

export interface Opportunity {
  typeId: number;
  name: string;
  sourceStationId: number;
  destinationStationId: number;
  sourcePrice: number | null;
  destinationPrice: number | null;
  priceValidationSource: PriceValidationSource;
  netProfitISK: number;
  margin: number;
  recentDailyVolume: number;
  arbitrageQuantity: number;
  totalCostISK: number;
  totalProfitISK: number;
}

export interface DestinationGroup {
  destinationStationId: number;
  stationName?: string;
  totalItems: number;
  totalCostISK: number;
  totalProfitISK: number;
  averageMargin: number;
  items: Opportunity[];
}

export interface ArbitrageCheckResponse {
  [stationId: string]: DestinationGroup;
}

export interface ArbitrageOpportunity {
  typeId: number;
  typeName: string;
  buyStationId: number;
  buyStationName: string;
  sellStationId: number;
  sellStationName: string;
  buyPrice: number;
  sellPrice: number;
  profitPerUnit: number;
  roi: number;
  volume: number;
  estimatedProfit: number;
  liquidity?: {
    dailyVolume: number;
    daysToSell: number;
  };
}

export interface LiquidityOptions {
  windowDays?: number;
  minCoverageRatio?: number;
  minLiquidityThresholdISK?: number;
  minWindowTrades?: number;
}

export interface ArbitrageOptions {
  maxInventoryDays?: number;
  minMarginPercent?: number;
  maxPriceDeviationMultiple?: number;
  destinationStationIds?: number[];
  excludeDestinationStationIds?: number[];
  disableInventoryLimit?: boolean;
  allowInventoryTopOff?: boolean;
  salesTaxPercent?: number;
  brokerFeePercent?: number;
  minTotalProfitISK?: number;
}

export interface PlanPackagesRequest {
  shippingCostByStation: Record<string, number>;
  packageCapacityM3: number;
  investmentISK: number;
  perDestinationMaxBudgetSharePerItem?: number;
  maxPackagesHint?: number;
  maxPackageCollateralISK?: number;
  courierContracts?: Array<{
    id: string;
    label: string;
    maxVolumeM3: number;
    maxCollateralISK: number;
  }>;
  minPackageNetProfitISK?: number;
  minPackageROIPercent?: number;
  shippingMarginMultiplier?: number;
  densityWeight?: number;
  destinationCaps?: Record<string, { maxShare?: number; maxISK?: number }>;
  allocation?: {
    mode?: "best" | "targetWeighted" | "roundRobin";
    targets?: Record<string, number>;
    spreadBias?: number;
  };
  liquidityOptions?: LiquidityOptions;
  arbitrageOptions?: ArbitrageOptions;
}

export interface PackedUnit {
  typeId: number;
  name: string;
  units: number;
  unitCost: number;
  unitProfit: number;
  unitVolume: number;
  spendISK: number;
  profitISK: number;
  volumeM3: number;
}

export interface PackagePlan {
  packageIndex: number;
  destinationStationId: number;
  destinationName?: string;
  courierContractId?: string;
  courierContractLabel?: string;
  courierMaxVolumeM3?: number;
  courierMaxCollateralISK?: number;
  items: PackedUnit[];
  spendISK: number;
  grossProfitISK: number;
  shippingISK: number;
  netProfitISK: number;
  usedCapacityM3: number;
  efficiency: number;
}

export interface PlanResult {
  packages: PackagePlan[];
  totalSpendISK: number;
  totalGrossProfitISK: number;
  totalShippingISK: number;
  totalNetProfitISK: number;
  itemExposureByDest: Record<
    number,
    Record<number, { spendISK: number; units: number }>
  >;
  destSpend: Record<number, number>;
  notes: string[];
}

export interface Package {
  id: string;
  cycleId: string | null;
  status: string;
  destinationStationId: number;
  destinationStationName?: string;
  totalBuyPriceIsk: string;
  totalVolume: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CommittedPackage {
  id: string;
  cycleId: string;
  packageIndex: number;
  destinationStationId: number;
  destinationName: string | null;
  collateralIsk: string;
  shippingCostIsk: string;
  estimatedProfitIsk: string;
  status: string;
  committedAt: string;
  failedAt: string | null;
  collateralRecoveredIsk: string | null;
  failureMemo: string | null;
  itemCount: number;
  totalUnits: number;
  totalVolumeM3: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  typeId: number;
  typeName?: string;
  quantity: number;
  buyPricePerUnit: string;
  totalBuyPrice: string;
  volume: string;
}
