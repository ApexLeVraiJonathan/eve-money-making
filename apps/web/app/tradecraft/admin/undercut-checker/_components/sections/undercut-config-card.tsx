import { Button } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Checkbox } from "@eve/ui";
import { Input } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import type { GroupingMode } from "../lib/types";

type Station = {
  id: string;
  stationId: number;
  station?: { name?: string | null } | null;
};

type Props = {
  useCommit: boolean;
  setUseCommit: (value: boolean) => void;
  groupingMode: GroupingMode;
  setGroupingMode: (value: GroupingMode) => void;
  showNegativeProfit: boolean;
  setShowNegativeProfit: (value: boolean) => void;
  cycleId: string;
  setCycleId: (value: string) => void;
  selectedStations: number[];
  setSelectedStations: (updater: (prev: number[]) => number[]) => void;
  selfMarketStructureId: number | null;
  stations: Station[];
  onRun: () => void;
  isPending: boolean;
  isCnSelected: boolean;
};

export function UndercutConfigCard({
  useCommit,
  setUseCommit,
  groupingMode,
  setGroupingMode,
  showNegativeProfit,
  setShowNegativeProfit,
  cycleId,
  setCycleId,
  selectedStations,
  setSelectedStations,
  selfMarketStructureId,
  stations,
  onRun,
  isPending,
  isCnSelected,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Configuration
        </CardTitle>
        <CardDescription>Configure which items to check for undercuts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-commit"
            checked={useCommit}
            onCheckedChange={(checked) => setUseCommit(checked === true)}
          />
          <Label htmlFor="use-commit" className="cursor-pointer">
            Use latest open cycle
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="grouping-mode">Grouping Mode</Label>
          <Select
            value={groupingMode}
            onValueChange={(value) => setGroupingMode(value as GroupingMode)}
          >
            <SelectTrigger id="grouping-mode" className="w-full">
              <SelectValue placeholder="Select grouping mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="perOrder">Per order (show all orders)</SelectItem>
              <SelectItem value="perCharacter">
                Per character (primary order only)
              </SelectItem>
              <SelectItem value="global">
                Global (single order per item/station)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {groupingMode === "perOrder" && "Show all orders for each item"}
            {groupingMode === "perCharacter" &&
              "Show orders selected to consolidate per character/item/station (highest remaining first)"}
            {groupingMode === "global" &&
              "Show orders selected to consolidate per item/station across all characters (highest remaining first)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="show-negative-profit"
            checked={showNegativeProfit}
            onCheckedChange={(checked) => setShowNegativeProfit(checked === true)}
          />
          <Label htmlFor="show-negative-profit" className="cursor-pointer">
            Show negative profit orders (red)
          </Label>
        </div>

        {useCommit && (
          <div className="space-y-2">
            <Label>Cycle ID</Label>
            <Input
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              placeholder="Enter cycle ID"
            />
          </div>
        )}

        {useCommit && cycleId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md bg-muted/50">
            <CheckCircle2 className="h-4 w-4" />
            Using cycle {cycleId.slice(0, 8)}…
          </div>
        )}

        {!useCommit && (
          <div className="space-y-2">
            <Label>Stations</Label>
            <div className="flex flex-wrap gap-2">
              {selfMarketStructureId !== null && (
                <label
                  key="self-market-cn"
                  className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                    selectedStations.includes(selfMarketStructureId)
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedStations.includes(selfMarketStructureId)}
                    onCheckedChange={(isChecked) => {
                      setSelectedStations((prev) =>
                        isChecked
                          ? [...prev, selfMarketStructureId]
                          : prev.filter((id) => id !== selfMarketStructureId),
                      );
                    }}
                  />
                  <span className="text-sm">C-N (Structure)</span>
                </label>
              )}
              {stations.map((s) => {
                if (
                  selfMarketStructureId !== null &&
                  s.stationId === selfMarketStructureId
                ) {
                  return null;
                }
                const checked = selectedStations.includes(s.stationId);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                      checked
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(isChecked) => {
                        setSelectedStations((prev) =>
                          isChecked
                            ? [...prev, s.stationId]
                            : prev.filter((id) => id !== s.stationId),
                        );
                      }}
                    />
                    <span className="text-sm">{s.station?.name ?? s.stationId}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <Button
          onClick={onRun}
          disabled={isPending || (useCommit && !cycleId)}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Check
            </>
          )}
        </Button>
        {isCnSelected && isPending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Fetching C-N market data…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
