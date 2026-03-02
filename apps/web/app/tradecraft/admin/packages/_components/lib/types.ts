import type { CommittedPackage } from "@eve/shared/tradecraft-market";

export type PackageDetails = {
  id: string;
  packageIndex: number;
  destinationName: string | null;
  collateralIsk: string;
  status: string;
  items: Array<{
    id: string;
    typeId: number;
    typeName: string;
    units: number;
    unitCost: string;
    unitProfit: string;
  }>;
  linkedCycleLines: Array<{
    cycleLineId: string;
    typeId: number;
    typeName: string | null;
    unitsCommitted: number;
    plannedUnits: number;
    unitsBought: number;
    unitsSold: number;
    buyCostIsk: string;
    hasSales: boolean;
    maxRemovableUnits: number;
    lostUnitsCandidate: number;
  }>;
  canMarkFailed: boolean;
  validationMessage: string | null;
};

export type PackagesByDestinationGroup = {
  destination: string;
  packages: CommittedPackage[];
};
