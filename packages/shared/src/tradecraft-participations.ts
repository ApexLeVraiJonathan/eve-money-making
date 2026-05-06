import type {
  CycleParticipation,
  CycleParticipationWithCycle,
} from "./types/participations.js";
export type {
  CycleParticipation,
  CycleParticipationWithCycle,
  ParticipationCycleSummary,
  RolloverIntent,
} from "./types/participations.js";

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

export type ParticipationHistoryItem = CycleParticipationWithCycle;

export type UnmatchedDonation = {
  journalId: string;
  characterId: number;
  characterName: string;
  amount: string;
  description: string | null;
  reason: string | null;
  date: string;
};

export type MatchedParticipationPaymentUnmatchedJournal = {
  journalId: string;
  characterId: number;
  amount: string;
  description: string | null;
  reason: string | null;
  date: string;
};

export type MatchParticipationPaymentsResponse = {
  matched: number;
  partial: number;
  unmatched: MatchedParticipationPaymentUnmatchedJournal[];
};

export type IncreaseParticipationResponse = {
  participation: CycleParticipation;
  previousAmountIsk: string;
  deltaAmountIsk: string;
  newAmountIsk: string;
};
