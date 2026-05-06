import type { ParticipationStatus, RolloverType } from "./core-enums.js";

export interface RolloverIntent {
  rolloverType: RolloverType | null;
  rolloverRequestedAmountIsk: string | null;
  rolloverFromParticipationId: string | null;
}

export interface CycleParticipation extends RolloverIntent {
  id: string;
  cycleId: string;
  userId: string | null;
  characterName: string;
  amountIsk: string;
  userPrincipalIsk: string | null;
  status: ParticipationStatus;
  memo: string;
  validatedAt: string | null;
  walletJournalId: string | null;
  payoutAmountIsk: string | null;
  payoutPaidAt: string | null;
  rolloverDeductedIsk: string | null;
  refundAmountIsk: string | null;
  refundedAt: string | null;
  optedOutAt: string | null;
  jingleYieldProgramId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ParticipationCycleSummary = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  status: string;
};

export type CycleParticipationWithCycle = CycleParticipation & {
  cycle: ParticipationCycleSummary;
};

export interface JingleYieldProgramSummary {
  id: string;
  userId: string;
  adminCharacterId: number;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  status: string;
  minCycles: number;
  cyclesCompleted: number;
  startCycle: {
    id: string;
    name: string | null;
    startedAt: string;
  } | null;
  completedCycle: {
    id: string;
    name: string | null;
    closedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JingleYieldStatus {
  id: string;
  userId: string;
  status: string;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  minCycles: number;
  cyclesCompleted: number;
  startCycle: {
    id: string;
    name: string | null;
    startedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
