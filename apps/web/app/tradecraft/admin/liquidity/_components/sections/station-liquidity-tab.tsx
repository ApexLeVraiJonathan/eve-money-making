import { Button } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { Input } from "@eve/ui";
import { LabeledInput } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { BarChart3, Loader2, Search, Navigation, ArrowUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { ParameterProfileManager } from "../../../../components/ParameterProfileManager";
import type {
  LiquidityCheckResponse,
  LiquidityItemDto,
} from "@eve/shared/tradecraft-pricing";
import { sortByStationName } from "../../../../lib/station-sorting";

type StationOption = {
  id: string | number;
  stationId: number;
  station?: { name?: string | null } | null;
};

type Props = {
  stationId: number | null;
  setStationId: (value: number | null) => void;
  windowDays: number;
  setWindowDays: (value: number) => void;
  minCoverageRatio: number;
  setMinCoverageRatio: (value: number) => void;
  minLiquidityThresholdISK: number;
  setMinLiquidityThresholdISK: (value: number) => void;
  minWindowTrades: number;
  setMinWindowTrades: (value: number) => void;
  sortedStations: StationOption[];
  onRunCheck: () => void;
  isPending: boolean;
  getCurrentParams: () => Record<string, unknown>;
  handleLoadProfile: (params: Record<string, unknown>) => void;
  checkResult: LiquidityCheckResponse | null;
};

export function StationLiquidityTab({
  stationId,
  setStationId,
  windowDays,
  setWindowDays,
  minCoverageRatio,
  setMinCoverageRatio,
  minLiquidityThresholdISK,
  setMinLiquidityThresholdISK,
  minWindowTrades,
  setMinWindowTrades,
  sortedStations,
  onRunCheck,
  isPending,
  getCurrentParams,
  handleLoadProfile,
  checkResult,
}: Props) {
  const sortedEntries = checkResult
    ? sortByStationName(
        Object.entries(checkResult).map(([stationIdStr, group]) => ({
          stationIdStr,
          ...group,
        })),
      )
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Scan Configuration
              </CardTitle>
              <CardDescription>
                Find liquid items at tracked stations based on trading volume and
                frequency
              </CardDescription>
            </div>
            <ParameterProfileManager
              scope="LIQUIDITY"
              currentParams={getCurrentParams()}
              onLoadProfile={handleLoadProfile}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <LabeledInput
            label="Station"
            tooltip="Select a specific station to analyze, or leave empty to scan all tracked stations."
          >
            <Select
              value={stationId?.toString() ?? "all"}
              onValueChange={(value) =>
                setStationId(value === "all" ? null : Number(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All tracked stations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tracked stations</SelectItem>
                {sortedStations.map((s) => (
                  <SelectItem key={s.id} value={s.stationId.toString()}>
                    {s.station?.name ?? s.stationId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledInput>

          <LabeledInput
            label="Time Window (days)"
            tooltip="Days to look back for average daily trade metrics."
          >
            <Input
              type="number"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              min="1"
            />
          </LabeledInput>

          <LabeledInput
            label="Minimum Coverage Ratio"
            tooltip="Fraction of days that must have trades (0-1)."
          >
            <Input
              type="number"
              value={minCoverageRatio}
              onChange={(e) => setMinCoverageRatio(Number(e.target.value))}
              min="0"
              max="1"
              step="0.01"
            />
          </LabeledInput>

          <LabeledInput
            label="Minimum Daily ISK Volume"
            tooltip="Minimum average ISK traded per day."
          >
            <Input
              type="number"
              value={minLiquidityThresholdISK}
              onChange={(e) => setMinLiquidityThresholdISK(Number(e.target.value))}
              min="0"
            />
          </LabeledInput>

          <LabeledInput
            label="Minimum Trades Per Day"
            tooltip="Minimum average number of trades per day."
          >
            <Input
              type="number"
              value={minWindowTrades}
              onChange={(e) => setMinWindowTrades(Number(e.target.value))}
              min="0"
            />
          </LabeledInput>

          <Button
            onClick={onRunCheck}
            disabled={isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Run Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {sortedEntries.length > 0 && (
        <div className="space-y-4">
          {sortedEntries.length > 1 && (
            <div className="sticky top-0 z-50 bg-card border rounded-lg shadow-md p-3 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Navigation className="h-4 w-4" />
                    <span>Jump to:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortedEntries.map((group) => (
                      <Button
                        key={group.stationIdStr}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const element = document.getElementById(
                            `station-${group.stationIdStr}`,
                          );
                          if (element) {
                            const navHeight = 80;
                            const elementPosition =
                              element.getBoundingClientRect().top + window.scrollY;
                            window.scrollTo({
                              top: elementPosition - navHeight,
                              behavior: "smooth",
                            });
                          }
                        }}
                      >
                        {group.stationName.split(" ")[0]}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="shrink-0"
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Parameters
                </Button>
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold">
            Results ({sortedEntries.length} station
            {sortedEntries.length !== 1 ? "s" : ""})
          </h2>

          {sortedEntries.map((group) => (
            <Card key={group.stationIdStr} id={`station-${group.stationIdStr}`}>
              <CardHeader>
                <CardTitle>{group.stationName}</CardTitle>
                <CardDescription>
                  {group.totalItems} liquid item{group.totalItems !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-3 text-left">Item</th>
                        <th className="py-2 px-3 text-right">Avg Daily Vol</th>
                        <th className="py-2 px-3 text-right">Avg Daily Trades</th>
                        <th className="py-2 px-3 text-right">Coverage Days</th>
                        <th className="py-2 px-3 text-right">Latest Avg Price</th>
                        <th className="py-2 px-3 text-right">Avg Daily ISK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item: LiquidityItemDto, idx: number) => (
                        <tr
                          key={idx}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-2 px-3">{item.typeName ?? item.typeId}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {item.avgDailyAmount.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {item.avgDailyTrades}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {item.coverageDays} / {windowDays}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {item.latest ? formatIsk(Number(item.latest.avg)) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatIsk(item.avgDailyIskValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
