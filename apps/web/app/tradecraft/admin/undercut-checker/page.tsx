"use client";
import { useEffect, useState } from "react";
import { Button } from "@eve/ui";
import { Label } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
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
  AlertTriangle,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  useTrackedStations,
  useArbitrageCommits,
  useUndercutCheck,
  useCycleLines,
  useAddBulkRelistFees,
  useUpdateBulkSellPrices,
} from "../../api";
import type { UndercutCheckGroup } from "@eve/shared/types";

export default function UndercutCheckerPage() {
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<UndercutCheckGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [groupingMode, setGroupingMode] = useState<
    "perOrder" | "perCharacter" | "global"
  >("perCharacter");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNegativeProfit, setShowNegativeProfit] = useState<boolean>(false);
  const RELIST_PCT = Number(process.env.NEXT_PUBLIC_BROKER_RELIST_PCT ?? 0.3);

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

  const getProfitCategory = (
    marginPercent: number | undefined,
  ): "red" | "yellow" | "normal" => {
    if (marginPercent === undefined) return "normal";
    if (marginPercent <= -10) return "red";
    if (marginPercent < 0) return "yellow";
    return "normal";
  };

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
      // API returns array directly (UndercutCheckResponse)
      setResult(data);
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
      setSelected(initial);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

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
        if (!selected[key]) continue;

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
                "Show orders selected to consolidate per character/item/station (lowest remaining first)"}
              {groupingMode === "global" &&
                "Show orders selected to consolidate per item/station across all characters (lowest remaining first)"}
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

          {result.map((group, gi) => {
            const visibleUpdates = group.updates.filter((u) => {
              const category = getProfitCategory(u.estimatedMarginPercentAfter);
              return showNegativeProfit || category !== "red";
            });

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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={
                                visibleUpdates.every(
                                  (u) =>
                                    selected[
                                      `${group.characterId}:${group.stationId}:${u.orderId}`
                                    ],
                                ) && visibleUpdates.length > 0
                              }
                              onChange={(e) => {
                                const keys = visibleUpdates.map(
                                  (u) =>
                                    `${group.characterId}:${group.stationId}:${u.orderId}`,
                                );
                                setSelected((prev) => {
                                  const next = { ...prev };
                                  for (const k of keys)
                                    next[k] = e.target.checked;
                                  return next;
                                });
                              }}
                            />
                          </th>
                          <th
                            className="py-2 px-3 whitespace-nowrap text-center"
                            title="Warning"
                          >
                            ⚠️
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap text-left">
                            Item
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap text-right">
                            Current
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap text-right">
                            Suggested
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap text-right">
                            Remain
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap text-right">
                            Relist Fee ({RELIST_PCT}%)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUpdates.map((u, ui) => {
                          const key = `${group.characterId}:${group.stationId}:${u.orderId}`;
                          const category = getProfitCategory(
                            u.estimatedMarginPercentAfter,
                          );
                          const rowBgClass =
                            category === "red"
                              ? "bg-red-100 dark:bg-red-950/30"
                              : category === "yellow"
                                ? "bg-yellow-100 dark:bg-yellow-950/30"
                                : "";
                          const expiryNote =
                            u.isExpiringSoon &&
                            typeof u.expiresInHours === "number"
                              ? `Expires in ${u.expiresInHours.toFixed(1)}h`
                              : undefined;
                          return (
                            <tr
                              key={ui}
                              className={`border-b ${rowBgClass}`}
                              title={
                                u.estimatedMarginPercentAfter !== undefined
                                  ? `Margin: ${u.estimatedMarginPercentAfter.toFixed(1)}%, Profit: ${formatIsk(u.estimatedProfitIskAfter ?? 0)}${expiryNote ? `, ${expiryNote}` : ""}`
                                  : undefined
                              }
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={!!selected[key]}
                                  onChange={() => toggle(key)}
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                {category === "red" && (
                                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 inline" />
                                )}
                                {category === "yellow" && (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 inline" />
                                )}
                                {u.isExpiringSoon && (
                                  <span title={expiryNote ?? "Expiring soon"}>
                                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 inline ml-1" />
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-left whitespace-nowrap">
                                {u.itemName}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{formatIsk(u.currentPrice)}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyPrice(u.suggestedNewPriceTicked, key)
                                    }
                                    className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    title="Copy suggested price"
                                    aria-label="Copy suggested price"
                                  >
                                    {copiedKey === key ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 font-medium text-right">
                                {formatIsk(u.suggestedNewPriceTicked)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {u.remaining}
                              </td>
                              <td className="py-2 px-3 font-medium text-right">
                                {formatIsk(
                                  u.remaining *
                                    u.suggestedNewPriceTicked *
                                    (RELIST_PCT / 100),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t">
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3" colSpan={3}></td>
                          <td className="py-2 px-3 text-right font-medium">
                            Total relist fee (selected):
                          </td>
                          <td className="py-2 px-3 font-semibold text-right">
                            {formatIsk(
                              visibleUpdates.reduce((s, u) => {
                                const key = `${group.characterId}:${group.stationId}:${u.orderId}`;
                                return (
                                  s +
                                  (selected[key]
                                    ? u.remaining *
                                      u.suggestedNewPriceTicked *
                                      (RELIST_PCT / 100)
                                    : 0)
                                );
                              }, 0),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
