import type { CycleOverview, CycleSnapshot } from "@eve/shared/tradecraft-cycles";
import type { CycleParticipation } from "@eve/shared/tradecraft-participations";

export type CycleDetailsCycle = NonNullable<CycleOverview["current"]> & {
  myParticipation?: CycleParticipation | null;
};

export type CapitalDistributionDatum = {
  name: "Cash" | "Inventory";
  value: number;
  fill: string;
};

export type CapitalTrendPoint = {
  date: string;
  cash: number;
  inventory: number;
  total: number;
};

export type ProfitTrendPoint = {
  date: string;
  profit: number;
};

export type CycleDetailsSnapshot = CycleSnapshot;
