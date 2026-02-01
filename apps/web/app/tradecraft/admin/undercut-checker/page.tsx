"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import { UndercutResultsTable } from "./undercut-results-table";
import {
  useTrackedStations,
  useArbitrageCommits,
  useUndercutCheck,
  useCycleLines,
  useAddBulkRelistFees,
  useUpdateBulkSellPrices,
} from "../../api";
import type { UndercutCheckGroup } from "@eve/shared/types";

type ProfitCategory = "red" | "yellow" | "normal";

function getProfitCategory(
  marginPercent: number | undefined,
): ProfitCategory {
  if (marginPercent === undefined) return "normal";
  if (marginPercent <= -10) return "red";
  if (marginPercent < 0) return "yellow";
  return "normal";
}

type SelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  get: (key: string) => boolean;
  toggle: (key: string) => void;
  setMany: (keys: string[], checked: boolean) => void;
  replaceAll: (next: Record<string, boolean>) => void;
};

export default function UndercutCheckerPage() {
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<UndercutCheckGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [groupingMode, setGroupingMode] = useState<
    "perOrder" | "perCharacter" | "global"
  >("perCharacter");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNegativeProfit, setShowNegativeProfit] = useState<boolean>(false);
  const RELIST_PCT = Number(process.env.NEXT_PUBLIC_BROKER_RELIST_PCT ?? 0.3);

  // Selection store:
  // - Avoids cloning a huge object on each click
  // - Uses subscriptions so only the checkbox + footer need to update (not the whole table)
  const selectionStoreRef = useRef<SelectionStore | null>(null);
  if (!selectionStoreRef.current) {
    const state: { selected: Record<string, boolean> } = { selected: {} };
    const listeners = new Set<() => void>();
    let version = 0;
    const notify = () => {
      version += 1;
      for (const l of Array.from(listeners)) l();
    };

    selectionStoreRef.current = {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getVersion: () => version,
      get: (key) => !!state.selected[key],
      toggle: (key) => {
        state.selected[key] = !state.selected[key];
        notify();
      },
      setMany: (keys, checked) => {
        for (const k of keys) state.selected[k] = checked;
        notify();
      },
      replaceAll: (next) => {
        state.selected = next;
        notify();
      },
    };
  }

  const selectionStore = selectionStoreRef.current;

  // React Query hooks
  const { data: stations = [] } = useTrackedStations();
  const { data: latestCycles = [] } = useArbitrageCommits(
    { limit: 5 },
    { enabled: useCommit }, // Only fetch cycles when using cycle mode
  );
  const undercutCheckMutation = useUndercutCheck();
  const { data: cycleLines = [] } = useCycleLines(cycleId);
  const addBulkRelistFeesMutation = useAddBulkRelistFees();
  const updateBulkSellPricesMutation = useUpdateBulkSellPrices();

  // Auto-set cycle ID from latest cycles
  useEffect(() => {
    if (useCommit && latestCycles.length > 0) {
      const openCycle = latestCycles.find((r) => r.status === "OPEN");
      if (openCycle) {
        setCycleId(openCycle.id);
      } else {
        setCycleId(latestCycles[0].id);
      }
    }
  }, [useCommit, latestCycles]);

  const groupsToRender = useMemo(() => {
    if (!Array.isArray(result) || result.length === 0) return [];

    return result.map((group) => {
      const updates = group.updates
        .filter((u) => {
          const category = getProfitCategory(u.estimatedMarginPercentAfter);
          return showNegativeProfit || category !== "red";
        })
        // EVE client typically shows larger remaining stacks first; the API can return
        // "consolidation-friendly" ordering (smallest first), which looks reversed in UI.
        .toSorted((a, b) => {
          const byItem = a.itemName.localeCompare(b.itemName);
          if (byItem !== 0) return byItem;
          if (a.remaining !== b.remaining) return b.remaining - a.remaining;
          if (a.currentPrice !== b.currentPrice)
            return b.currentPrice - a.currentPrice;
          return b.orderId - a.orderId;
        });

      return { group, updates };
    });
  }, [result, showNegativeProfit]);

  const onRun = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await undercutCheckMutation.mutateAsync({
        stationIds: useCommit
          ? undefined
          : selectedStations.length
            ? selectedStations
            : undefined,
        cycleId: useCommit && cycleId ? cycleId : undefined,
        groupingMode,
      });
      // Default select based on profit category
      const initial: Record<string, boolean> = {};
      for (const g of data) {
        for (const u of g.updates) {
          const key = `${g.characterId}:${g.stationId}:${u.orderId}`;
          const category = getProfitCategory(u.estimatedMarginPercentAfter);
          // Red (≤ -10%): unchecked by default
          // Yellow (-10% < profit < 0%): checked by default
          // Normal (≥ 0%): checked by default
          initial[key] = category !== "red";
        }
      }
      selectionStore.replaceAll(initial);

      // API returns array directly (UndercutCheckResponse)
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const copyPrice = async (price: number, key: string) => {
    try {
      await navigator.clipboard.writeText(price.toFixed(2));
      setCopiedKey(key);
      // Keep the green check visible until another copy is clicked
    } catch (err) {
      console.error("Failed to copy price:", err);
    }
  };

  const onConfirmReprice = async () => {
    if (!cycleId || !result || cycleLines.length === 0) return;

    setError(null);

    const errors: string[] = [];
    const relistFees: Array<{ lineId: string; amountIsk: string }> = [];
    const priceUpdates: Array<{
      lineId: string;
      currentSellPriceIsk: string;
    }> = [];

    for (const g of result) {
      for (const u of g.updates) {
        const key = `${g.characterId}:${g.stationId}:${u.orderId}`;
        if (!selectionStore.get(key)) continue;

        // Find matching cycle line by typeId and stationId
        const line = cycleLines.find(
          (l) =>
            Number(l.typeId) === Number(u.typeId) &&
            Number(l.destinationStationId) === Number(g.stationId),
        );

        if (!line) {
          errors.push(
            `Could not find cycle line for ${u.itemName} (typeId: ${u.typeId}, stationId: ${g.stationId})`,
          );
          continue;
        }

        // Calculate relist fee (RELIST_PCT%)
        const total = u.remaining * u.suggestedNewPriceTicked;
        const feeAmount = (total * (RELIST_PCT / 100)).toFixed(2);

        relistFees.push({
          lineId: line.id,
          amountIsk: feeAmount,
        });

        priceUpdates.push({
          lineId: line.id,
          currentSellPriceIsk: u.suggestedNewPriceTicked.toFixed(2),
        });
      }
    }

    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }

    // Add all relist fees in bulk
    try {
      await addBulkRelistFeesMutation.mutateAsync({ fees: relistFees });
    } catch (e) {
      setError(
        `Failed to add relist fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    // Update current sell prices for all lines in bulk
    try {
      await updateBulkSellPricesMutation.mutateAsync({
        updates: priceUpdates,
      });
    } catch (e) {
      setError(
        `Failed to update sell prices: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    setError(null);
    alert("Relist fees recorded successfully!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <TrendingDown className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Undercut Checker
          </h1>
          <p className="text-sm text-muted-foreground">
            Check for undercuts and manage repricing
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure which items to check for undercuts
          </CardDescription>
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
              onValueChange={(value) =>
                setGroupingMode(value as "perOrder" | "perCharacter" | "global")
              }
            >
              <SelectTrigger id="grouping-mode" className="w-full">
                <SelectValue placeholder="Select grouping mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perOrder">
                  Per order (show all orders)
                </SelectItem>
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
              onCheckedChange={(checked) =>
                setShowNegativeProfit(checked === true)
              }
            />
            <Label htmlFor="show-negative-profit" className="cursor-pointer">
              Show negative profit orders (red)
            </Label>
          </div>

          {!useCommit && (
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
                {stations.map((s) => {
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
                      <span className="text-sm">
                        {s.station?.name ?? s.stationId}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            onClick={onRun}
            disabled={
              undercutCheckMutation.isPending || (useCommit && !cycleId)
            }
            className="gap-2"
          >
            {undercutCheckMutation.isPending ? (
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
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {Array.isArray(result) && result.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Undercut Results</h2>
            <Button
              onClick={onConfirmReprice}
              disabled={!useCommit || !cycleId}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Repriced
            </Button>
          </div>

          {groupsToRender.map(({ group, updates: visibleUpdates }, gi) => {
            return (
              <Card key={gi}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    {group.characterName ?? `Character ${group.characterId}`}
                  </CardTitle>
                  <CardDescription>
                    {group.stationName ?? `Station ${group.stationId}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UndercutResultsTable
                    group={group}
                    updates={visibleUpdates}
                    selectionStore={selectionStore}
                    copiedKey={copiedKey}
                    onCopyPrice={copyPrice}
                    relistPct={RELIST_PCT}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
