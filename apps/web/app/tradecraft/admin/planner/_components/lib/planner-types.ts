export type CourierMode = "blockade" | "dst" | "auto" | "custom";

export type AllocationMode = "best" | "targetWeighted" | "roundRobin";

export type PlannerCommitSuccess = {
  cycleId: string;
  packageCount: number;
};

export type PlannerRestoredDraft = {
  restoredAt: string;
};
