import type { ImportMarketTradesDayResult } from "@eve/shared/tradecraft-data-ops";

type MissingDayEntry = [string, ImportMarketTradesDayResult];

export function buildMissingTradesNote(
  entries: MissingDayEntry[],
  successes: number,
  failures: number,
): string {
  if (entries.length === 0) {
    return "No missing days were found for the selected range.";
  }

  const failedDates = entries
    .filter(([, value]) => !value.ok)
    .map(([date]) => date)
    .slice(0, 3);

  return failures === 0
    ? `Processed ${successes} missing day(s) successfully.`
    : `Processed ${entries.length} missing day(s): ${successes} succeeded, ${failures} failed${
        failedDates.length
          ? ` (e.g., ${failedDates.join(", ")}${failures > failedDates.length ? ", ..." : ""})`
          : ""
      }.`;
}
