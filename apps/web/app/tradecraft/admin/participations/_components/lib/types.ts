import type { CycleParticipationWithCycle } from "@eve/shared/tradecraft-participations";

export type ParticipationWithCycle = CycleParticipationWithCycle;

export type CycleGroup = {
  cycleId: string;
  cycleName: string | null;
  cycleStatus: string;
  startedAt: string | null;
  closedAt: string | null;
  participations: ParticipationWithCycle[];
};
