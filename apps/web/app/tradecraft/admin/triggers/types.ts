import type { CycleSnapshot } from "@eve/shared/tradecraft-cycles";
import type { GameDataImportSummaryResponse } from "@eve/shared/tradecraft-data-ops";
import type { TrackedStation } from "@eve/shared/tradecraft-market";
import type { MarketTradesStalenessResponse } from "@eve/shared/tradecraft-ops";
import type { MatchParticipationPaymentsResponse } from "@eve/shared/tradecraft-participations";

export type TriggerState = {
  [key: string]: boolean;
};

export type { TrackedStation, CycleSnapshot };
export type ImportSummary = GameDataImportSummaryResponse;
export type MarketStaleness = MarketTradesStalenessResponse;
export type MatchResult = MatchParticipationPaymentsResponse;
