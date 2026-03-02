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
import { BarChart3, Loader2, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import type { LiquidityItemStatsResponse } from "@eve/shared/tradecraft-pricing";
import { sortByStationName } from "../../../../lib/station-sorting";

type StationOption = {
  id: string | number;
  stationId: number;
  station?: { name?: string | null } | null;
};

type Props = {
  itemId: number | null;
  setItemId: (value: number | null) => void;
  itemName: string;
  setItemName: (value: string) => void;
  itemStatsStationId: number | null;
  setItemStatsStationId: (value: number | null) => void;
  itemStatsStationName: string;
  setItemStatsStationName: (value: string) => void;
  itemStatsWindowDays: number;
  setItemStatsWindowDays: (value: number) => void;
  isBuyOrder: boolean;
  setIsBuyOrder: (value: boolean) => void;
  sortedStations: StationOption[];
  onRunItemStats: () => void;
  isPending: boolean;
  itemStatsResult: LiquidityItemStatsResponse | null;
};

export function ItemLiquidityStatsTab({
  itemId,
  setItemId,
  itemName,
  setItemName,
  itemStatsStationId,
  setItemStatsStationId,
  itemStatsStationName,
  setItemStatsStationName,
  itemStatsWindowDays,
  setItemStatsWindowDays,
  isBuyOrder,
  setIsBuyOrder,
  sortedStations,
  onRunItemStats,
  isPending,
  itemStatsResult,
}: Props) {
  const sortedStatsEntries = itemStatsResult
    ? sortByStationName(
        Object.entries(itemStatsResult).map(([stationIdStr, stationData]) => ({
          stationIdStr,
          ...stationData,
        })),
      )
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Item Configuration
          </CardTitle>
          <CardDescription>
            Get detailed historical statistics for a specific item
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LabeledInput label="Item Name" tooltip="Name of the item to analyze.">
            <Input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Tritanium"
            />
          </LabeledInput>

          <LabeledInput label="Item ID (Alternative)" tooltip="EVE type ID.">
            <Input
              type="number"
              value={itemId ?? ""}
              onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}
              min="1"
            />
          </LabeledInput>

          <LabeledInput label="Station" tooltip="Select a station or use all tracked stations.">
            <Select
              value={itemStatsStationId?.toString() ?? "all"}
              onValueChange={(value) =>
                setItemStatsStationId(value === "all" ? null : Number(value))
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

          <LabeledInput label="Station Name (Alternative)" tooltip="Full station name override.">
            <Input
              type="text"
              value={itemStatsStationName}
              onChange={(e) => setItemStatsStationName(e.target.value)}
            />
          </LabeledInput>

          <LabeledInput label="Time Window (days)" tooltip="Days of historical data to include.">
            <Input
              type="number"
              value={itemStatsWindowDays}
              onChange={(e) => setItemStatsWindowDays(Number(e.target.value))}
              min="1"
            />
          </LabeledInput>

          <LabeledInput label="Order Side" tooltip="Choose sell or buy order stats.">
            <Select
              value={isBuyOrder ? "buy" : "sell"}
              onValueChange={(value) => setIsBuyOrder(value === "buy")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sell">Sell Orders</SelectItem>
                <SelectItem value="buy">Buy Orders</SelectItem>
              </SelectContent>
            </Select>
          </LabeledInput>

          <Button
            onClick={onRunItemStats}
            disabled={isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Get Stats
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {sortedStatsEntries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Stats for {itemName || `Item #${itemId}`} ({sortedStatsEntries.length} station
            {sortedStatsEntries.length !== 1 ? "s" : ""})
          </h2>

          {sortedStatsEntries.map((stationData) => (
            <Card key={stationData.stationIdStr}>
              <CardHeader>
                <CardTitle>{stationData.stationName}</CardTitle>
                <CardDescription>
                  Daily trade data over {itemStatsWindowDays} days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stationData.sell && (
                  <StatsTable
                    title="Sell Orders"
                    amountAvg={stationData.sell.windowAverages.amountAvg}
                    iskAvg={stationData.sell.windowAverages.iskValueAvg}
                    rows={stationData.sell.perDay}
                  />
                )}
                {stationData.buy && (
                  <StatsTable
                    title="Buy Orders"
                    amountAvg={stationData.buy.windowAverages.amountAvg}
                    iskAvg={stationData.buy.windowAverages.iskValueAvg}
                    rows={stationData.buy.perDay}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type DayRow = {
  date: string;
  amount: number;
  high: string | number;
  low: string | number;
  avg: string | number;
  orderNum: number;
  iskValue: string | number;
};

function StatsTable({
  title,
  amountAvg,
  iskAvg,
  rows,
}: {
  title: string;
  amountAvg: number;
  iskAvg: string | number;
  rows: DayRow[];
}) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground mb-2">
        Average: {amountAvg} units/day, {formatIsk(Number(iskAvg))} ISK/day
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-3 text-left">Date</th>
              <th className="py-2 px-3 text-right">Amount</th>
              <th className="py-2 px-3 text-right">High</th>
              <th className="py-2 px-3 text-right">Low</th>
              <th className="py-2 px-3 text-right">Avg</th>
              <th className="py-2 px-3 text-right">Trades</th>
              <th className="py-2 px-3 text-right">ISK Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((day, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3">{day.date}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {day.amount.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatIsk(Number(day.high))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatIsk(Number(day.low))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatIsk(Number(day.avg))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {day.orderNum}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatIsk(Number(day.iskValue))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
