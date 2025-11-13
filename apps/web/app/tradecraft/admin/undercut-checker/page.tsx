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
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Store,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  useTrackedStations,
  useArbitrageCommits,
  useUndercutCheck,
} from "../../api";

type Group = {
  characterId: number;
  characterName: string;
  stationId: number;
  stationName: string;
  updates: Array<{
    orderId: number;
    typeId: number;
    itemName: string;
    remaining: number;
    currentPrice: number;
    competitorLowest: number;
    suggestedNewPriceTicked: number;
  }>;
};

type TrackedStation = {
  id: string;
  stationId: number;
  station: { name: string };
};

type CycleLine = {
  id: string;
  typeId: number;
  destinationStationId: number;
  plannedUnits: number;
  unitsBought: number;
};

export default function UndercutCheckerPage() {
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const RELIST_PCT = Number(process.env.NEXT_PUBLIC_BROKER_RELIST_PCT ?? 0.3);

  // React Query hooks
  const { data: stations = [] } = useTrackedStations();
  const { data: latestCycles = [] } = useArbitrageCommits(
    { limit: 5 }, // Fetch a few cycles to ensure we can find the open one
    { enabled: useCommit },
  );
  const undercutCheckMutation = useUndercutCheck();

  const buildKeys = (rows: Group[] | null): string[] => {
    if (!Array.isArray(rows)) return [];
    const keys: string[] = [];
    for (const g of rows) {
      for (const u of g.updates) {
        keys.push(`${g.characterId}:${g.stationId}:${u.orderId}`);
      }
    }
    return keys;
  };

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
        cycleId: useCommit ? cycleId || undefined : undefined,
      });
      setResult(data);
      // Default select all items
      const allKeys = buildKeys(data);
      const initial: Record<string, boolean> = {};
      for (const k of allKeys) initial[k] = true;
      setSelected(initial);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const onConfirmReprice = async () => {
    if (!cycleId || !result) return;

    setError(null);

    // Fetch cycle lines
    let cycleLines: CycleLine[];
    try {
      const response = await fetch(`/api/ledger/cycles/${cycleId}/lines`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cycle lines: ${response.statusText}`);
      }
      cycleLines = await response.json();
    } catch (e) {
      setError(
        `Failed to fetch cycle lines: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    const errors: string[] = [];
    const relistFees: Array<{ lineId: string; amountIsk: string }> = [];
    const priceUpdates: Array<{ lineId: string; newPrice: string }> = [];

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
          newPrice: u.suggestedNewPriceTicked.toFixed(2),
        });
      }
    }

    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }

    // Add all relist fees in bulk
    try {
      const response = await fetch("/api/ledger/fees/relist/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees: relistFees }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add relist fees: ${errorText}`);
      }
    } catch (e) {
      setError(
        `Failed to add relist fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    // Update current sell prices for all lines in bulk
    try {
      const response = await fetch("/api/ledger/lines/sell-prices/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: priceUpdates }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update sell prices: ${errorText}`);
      }
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
            disabled={undercutCheckMutation.isPending || (useCommit && !cycleId)}
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

          {result.map((group, gi) => (
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
                              group.updates.every(
                                (u) =>
                                  selected[
                                    `${group.characterId}:${group.stationId}:${u.orderId}`
                                  ],
                              ) && group.updates.length > 0
                            }
                            onChange={(e) => {
                              const keys = group.updates.map(
                                (u) =>
                                  `${group.characterId}:${group.stationId}:${u.orderId}`,
                              );
                              const next: Record<string, boolean> = {};
                              for (const k of keys) next[k] = e.target.checked;
                              setSelected(next);
                            }}
                          />
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-left">
                          Item
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Remain
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Current
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Competitor Lowest
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Suggested
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Relist Fee ({RELIST_PCT}%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.updates.map((u, ui) => {
                        const key = `${group.characterId}:${group.stationId}:${u.orderId}`;
                        return (
                          <tr key={ui} className="border-b">
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={!!selected[key]}
                                onChange={() => toggle(key)}
                              />
                            </td>
                            <td className="py-2 px-3 text-left whitespace-nowrap">
                              {u.itemName}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {u.remaining}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatIsk(u.currentPrice)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatIsk(u.competitorLowest)}
                            </td>
                            <td className="py-2 px-3 font-medium text-right">
                              {formatIsk(u.suggestedNewPriceTicked)}
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
                        <td className="py-2 px-3" colSpan={4}></td>
                        <td className="py-2 px-3 text-right font-medium">
                          Total relist fee (selected):
                        </td>
                        <td className="py-2 px-3 font-semibold text-right">
                          {formatIsk(
                            group.updates.reduce((s, u) => {
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
          ))}
        </div>
      )}
    </div>
  );
}
