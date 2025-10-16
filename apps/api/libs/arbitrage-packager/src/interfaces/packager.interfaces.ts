export interface Item {
  typeId: number;
  name: string;
  sourceStationId: number;
  destinationStationId: number;
  sourcePrice: number; // unit cost c
  destinationPrice: number; // c + π
  netProfitISK?: number; // unit profit π (computed if not given)
  arbitrageQuantity: number; // q (already trimmed by you)
  m3: number; // unit volume v
}

export interface DestinationConfig {
  destinationStationId: number;
  shippingCostISK: number; // fixed per package for this destination
  items: Item[];
}

export interface DestinationCaps {
  maxShare?: number; // e.g., 0.40 => ≤40% of investmentISK to this destination
  maxISK?: number; // absolute budget cap to this destination
}

export interface AllocationOptions {
  mode?: 'best' | 'targetWeighted' | 'roundRobin';
  targets?: Record<number, number>; // destId -> desired share (sums to ~1); defaults to equal
  spreadBias?: number; // only for targetWeighted; default 0.5
}

export interface MultiPlanOptions {
  packageCapacityM3: number;
  investmentISK: number;
  // Per-destination risk cap: default 20% of total budget per *item* per *destination*
  perDestinationMaxBudgetSharePerItem?: number; // default 0.20
  maxPackagesHint?: number; // default 30
  // Maximum package collateral (total value of items in package) - default 5B ISK
  maxPackageCollateralISK?: number; // default 5_000_000_000
  // Per-destination market/budget caps (hard)
  destinationCaps?: Record<number, DestinationCaps>;
  // How to spread investment between destinations
  allocation?: AllocationOptions;
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
  items: PackedUnit[];
  spendISK: number;
  grossProfitISK: number;
  shippingISK: number;
  netProfitISK: number; // gross - shipping
  usedCapacityM3: number;
  efficiency: number; // netProfit / spend
}

export interface PlanResult {
  packages: PackagePlan[];
  totalSpendISK: number;
  totalGrossProfitISK: number;
  totalShippingISK: number;
  totalNetProfitISK: number;
  // exposure per destination per item
  itemExposureByDest: Record<
    number,
    Record<number, { spendISK: number; units: number }>
  >;
  destSpend: Record<number, number>;
  notes: string[];
}
