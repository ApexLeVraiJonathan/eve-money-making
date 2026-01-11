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

export interface CourierContractPreset {
  /** Stable identifier (e.g., 'blockade', 'dst', 'custom') */
  id: string;
  /** Human label for UI/debug */
  label: string;
  /** Maximum package volume for this courier contract */
  maxVolumeM3: number;
  /** Maximum collateral/value for this courier contract */
  maxCollateralISK: number;
}

export interface MultiPlanOptions {
  packageCapacityM3: number;
  investmentISK: number;
  // Per-destination risk cap: default 20% of total budget per *item* per *destination*
  perDestinationMaxBudgetSharePerItem?: number; // default 0.20
  maxPackagesHint?: number; // default 30
  // Maximum package collateral (total value of items in package) - default 5B ISK
  maxPackageCollateralISK?: number; // default 5_000_000_000
  /**
   * Optional set of courier contract presets.
   * When provided, the packager will choose the best feasible preset per package
   * (enables mixing contract types like Blockade + DST in a single run).
   */
  courierContracts?: CourierContractPreset[];
  // Package Quality Thresholds: reject packages below these minimums
  minPackageNetProfitISK?: number; // minimum net profit required per package (after shipping)
  minPackageROIPercent?: number; // minimum ROI required per package (netProfit/spend * 100)
  // Shipping margin multiplier: require boxProfit >= shippingCost * k (default 1.0 = break-even)
  shippingMarginMultiplier?: number; // default 1.0; e.g., 1.5 = require 50% more gross profit than shipping
  // Item Prioritization: blend density (profit/m³) vs ROI (profit/cost)
  densityWeight?: number; // default 1.0 = pure density; 0.0 = pure ROI; 0.5 = equal blend
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
  courierContractId?: string;
  courierContractLabel?: string;
  courierMaxVolumeM3?: number;
  courierMaxCollateralISK?: number;
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
