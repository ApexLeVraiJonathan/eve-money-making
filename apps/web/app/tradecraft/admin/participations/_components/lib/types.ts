import type { CycleParticipation } from "@eve/shared/tradecraft-participations";

export type ParticipationWithCycle = CycleParticipation & {
  cycle?: {
    id: string;
    name: string | null;
    startedAt: string;
    closedAt: string | null;
    status: string;
  } | null;
  jingleYieldProgramId?: string | null;
};

export type CycleGroup = {
  cycleId: string;
  cycleName: string | null;
  cycleStatus: string;
  startedAt: string | null;
  closedAt: string | null;
  participations: ParticipationWithCycle[];
};
