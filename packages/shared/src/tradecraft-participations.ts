import type { CycleParticipation } from "./types/participations";
export type { CycleParticipation, RolloverIntent } from "./types/participations";

export type AutoRolloverSettings = {
  enabled: boolean;
  defaultRolloverType: "FULL_PAYOUT" | "INITIAL_ONLY";
};

export type TradecraftCaps = {
  principalCapIsk: string;
  principalCapB: number;
  effectivePrincipalCapIsk: string;
  effectivePrincipalCapB: number;
  maximumCapIsk: string;
  maximumCapB: number;
};

export type ParticipationCycleSummary = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
  status: string;
};

export type ParticipationHistoryItem = CycleParticipation & {
  cycle: ParticipationCycleSummary;
};

export type UnmatchedDonation = {
  journalId: string;
  characterId: number;
  characterName: string;
  amount: string;
  description: string | null;
  reason: string | null;
  date: string;
};

export type MatchParticipationPaymentsResponse = {
  matched: number;
  partial: number;
  unmatched: unknown[];
};

export type IncreaseParticipationResponse = {
  participation: CycleParticipation;
  previousAmountIsk: string;
  deltaAmountIsk: string;
  newAmountIsk: string;
};
