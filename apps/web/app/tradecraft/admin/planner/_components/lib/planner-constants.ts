export const PLANNER_DRAFT_STORAGE_KEY = "planner-draft-v1";

export const COURIER_PRESETS = {
  blockade: {
    id: "blockade",
    label: "Blockade Runner",
    maxVolumeM3: 13_000,
    maxCollateralISK: 4_000_000_000,
  },
  dst: {
    id: "dst",
    label: "DST",
    maxVolumeM3: 60_000,
    maxCollateralISK: 2_000_000_000,
  },
} as const;

export const defaultPayload = {
  shippingCostByStation: {
    // DODIXIE (60011866): 15M
    // HEK (60005686): 15M
    // RENS (60004588): 20M
    // AMARR (60008494): 25M
    60008494: 25000000,
    60005686: 15000000,
    60011866: 15000000,
    60004588: 20000000,
  },
  // Defaults tuned for Blockade Runner style hauling (safer, smaller volume, higher collateral tolerance)
  packageCapacityM3: COURIER_PRESETS.blockade.maxVolumeM3,
  investmentISK: 36_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.15,
  maxPackagesHint: 100,
  maxPackageCollateralISK: COURIER_PRESETS.blockade.maxCollateralISK,
  allocation: { mode: "best" as const },
};
