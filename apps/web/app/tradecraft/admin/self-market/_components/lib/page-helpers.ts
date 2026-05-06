import { minutesSince } from "./market-utils";

export type MarketHub = "cn" | "rens";
export type MarketViewTab = "snapshot" | "daily";

export const NPC_RENS_STATION_ID = 60004588;
const STALE_SNAPSHOT_MINUTES = 30;

type TopErrorArgs = {
  statusError: unknown;
  snapshotError: unknown;
  snapshotTypesError: unknown;
  dailyError: unknown;
};

export function getSnapshotFreshness(observedAt: string | null | undefined): {
  ageMins: number | null;
  isStale: boolean;
} {
  const ageMins = minutesSince(observedAt ?? null);
  return {
    ageMins,
    isStale: ageMins !== null && ageMins > STALE_SNAPSHOT_MINUTES,
  };
}

export function getTopCnError(args: TopErrorArgs): unknown {
  return args.statusError ||
    args.snapshotError ||
    args.snapshotTypesError ||
    args.dailyError
    ? (args.statusError ?? args.snapshotError ?? args.dailyError)
    : null;
}
