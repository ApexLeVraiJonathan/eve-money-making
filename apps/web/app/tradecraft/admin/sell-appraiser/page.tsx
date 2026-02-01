"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@eve/ui";
import { Textarea } from "@eve/ui";
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
  Calculator,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Store,
} from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import {
  useTrackedStations,
  useArbitrageCommits,
  useSellAppraise,
  useSellAppraiseByCommit,
  useCycleLines,
  useAddBulkBrokerFees,
  useUpdateBulkSellPrices,
} from "../../api";
import type {
  SellAppraiseItem,
  SellAppraiseByCommitItem,
} from "@eve/shared/types";
import {
  SellAppraiserResultsTable,
  type SelectionStore,
} from "./sell-appraiser-results-table";

// Use shared types from @eve/shared/types
type PasteRow = SellAppraiseItem;
type CommitRow = SellAppraiseByCommitItem;

type GroupedResult = {
  destinationStationId: number;
  stationName: string;
  items: Array<PasteRow | CommitRow>;
};

function isCommitRow(row: PasteRow | CommitRow): row is CommitRow {
  return (row as CommitRow).typeId !== undefined && "quantityRemaining" in row;
}

export default function SellAppraiserPage() {
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<Array<PasteRow | CommitRow> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const BROKER_FEE_PCT = Number(process.env.NEXT_PUBLIC_BROKER_FEE_PCT ?? 1.5);

  // Selection store:
  // - Selection can be large
  // - Only checkboxes + footer need to update on toggle
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
    };
  }
  const selectionStore = selectionStoreRef.current;

  // React Query hooks
  const { data: stations = [] } = useTrackedStations();
  const { data: latestCycles = [] } = useArbitrageCommits(
    { limit: 5 },
    { enabled: useCommit }, // Only fetch cycles when using cycle mode
  );
  const sellAppraiseMutation = useSellAppraise();
  const sellAppraiseByCommitMutation = useSellAppraiseByCommit();
  const { data: cycleLines = [] } = useCycleLines(cycleId);
  const addBulkBrokerFeesMutation = useAddBulkBrokerFees();
  const updateBulkSellPricesMutation = useUpdateBulkSellPrices();

  // Sort items alphabetically: 0-9, A-Z (lexicographic/string order)
  const sortItems = (items: Array<PasteRow | CommitRow>) => {
    return items.sort((a, b) => {
      return a.itemName.localeCompare(b.itemName, "en", {
        sensitivity: "base",
      });
    });
  };

  // Sort destinations by specified order
  const sortDestinations = (groups: GroupedResult[]) => {
    const stationOrder = ["Dodixie", "Hek", "Rens", "Amarr"];

    return groups.sort((a, b) => {
      const indexA = stationOrder.findIndex((name) =>
        a.stationName.includes(name),
      );
      const indexB = stationOrder.findIndex((name) =>
        b.stationName.includes(name),
      );

      // If both stations are in the order list, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only one is in the list, it comes first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // If neither is in the list, sort alphabetically
      return a.stationName.localeCompare(b.stationName);
    });
  };

  // Group results by destination
  const groupedResults = useMemo<GroupedResult[]>(() => {
    if (!result) return [];
    const groupMap = new Map<number, Array<PasteRow | CommitRow>>();
    for (const r of result) {
      const list = groupMap.get(r.destinationStationId) ?? [];
      list.push(r);
      groupMap.set(r.destinationStationId, list);
    }
    const groups: GroupedResult[] = [];
    for (const [destId, items] of groupMap) {
      const station = stations.find((s) => s.stationId === destId);
      groups.push({
        destinationStationId: destId,
        stationName: station?.station?.name ?? `Station ${destId}`,
        items: sortItems(items),
      });
    }
    return sortDestinations(groups);
  }, [result, stations]);

  // Auto-set destination ID when stations load
  useEffect(() => {
    if (stations.length > 0 && destinationId === null) {
      setDestinationId(stations[0].stationId);
    }
  }, [stations, destinationId]);

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

  const lines = useMemo(() => paste.split(/\r?\n/).filter(Boolean), [paste]);

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    try {
      if (useCommit) {
        if (!cycleId) return;
        const data = await sellAppraiseByCommitMutation.mutateAsync({
          cycleId,
        });
        // API returns array directly (SellAppraiseByCommitResponse)
        setResult(data);
        // Default select all (stable key: stationId:typeId)
        const initial: Record<string, boolean> = {};
        for (const r of data) {
          initial[`${r.destinationStationId}:${r.typeId}`] = true;
        }
        selectionStore.setMany(Object.keys(initial), true);
      } else {
        if (!destinationId) return;
        const data = await sellAppraiseMutation.mutateAsync({
          lines,
          destinationStationId: destinationId,
        });
        // API returns array directly (SellAppraiseResponse)
        setResult(data);
        // Default select all (stable key: stationId:itemName)
        const initial: Record<string, boolean> = {};
        for (const r of data) {
          initial[`${r.destinationStationId}:${r.itemName}`] = true;
        }
        selectionStore.setMany(Object.keys(initial), true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const copySuggestedPrice = async (price: number, key: string) => {
    try {
      await navigator.clipboard.writeText(price.toFixed(2));
      setCopiedKey(key);
    } catch (err) {
      console.error("Failed to copy suggested price:", err);
    }
  };

  const onConfirmListed = async () => {
    if (!useCommit || !cycleId || !result || cycleLines.length === 0) return;

    setIsConfirming(true);
    setError(null);

    const errors: string[] = [];
    const brokerFees: Array<{ lineId: string; amountIsk: string }> = [];
    const priceUpdates: Array<{
      lineId: string;
      currentSellPriceIsk: string;
      quantity: number;
    }> = [];

    for (const r of result) {
      const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
      if (!selectionStore.get(key)) continue;
      if (!isCommitRow(r)) continue; // Skip paste rows
      if (r.suggestedSellPriceTicked === null) {
        errors.push(`${r.itemName}: No suggested price available (skipped)`);
        continue;
      }

      // Find matching cycle line
      const line = cycleLines.find(
        (l) =>
          Number(l.typeId) === Number(r.typeId) &&
          Number(l.destinationStationId) === Number(r.destinationStationId),
      );

      if (!line) {
        errors.push(
          `Could not find cycle line for ${r.itemName} (typeId: ${r.typeId}, stationId: ${r.destinationStationId})`,
        );
        continue;
      }

      // Calculate broker fee (BROKER_FEE_PCT%)
      const total = r.quantityRemaining * r.suggestedSellPriceTicked;
      const feeAmount = (total * (BROKER_FEE_PCT / 100)).toFixed(2);

      brokerFees.push({
        lineId: line.id,
        amountIsk: feeAmount,
      });

      priceUpdates.push({
        lineId: line.id,
        currentSellPriceIsk: r.suggestedSellPriceTicked.toFixed(2),
        quantity: r.quantityRemaining,
      });
    }

    if (errors.length) {
      setError(errors.join("\n"));
      setIsConfirming(false);
      return;
    }

    // Add all broker fees in bulk
    try {
      await addBulkBrokerFeesMutation.mutateAsync({ fees: brokerFees });
    } catch (e) {
      setError(
        `Failed to add broker fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      setIsConfirming(false);
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
      setIsConfirming(false);
      return;
    }

    setError(null);
    alert("Broker fees recorded and current sell prices updated successfully!");
    setIsConfirming(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Calculator className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sell Appraiser
          </h1>
          <p className="text-sm text-muted-foreground">
            Calculate optimal sell prices for your inventory
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure items to appraise for selling
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
            <>
              <div className="space-y-2">
                <Label>Destination Station</Label>
                <Select
                  value={destinationId?.toString() ?? ""}
                  onValueChange={(value) => setDestinationId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.stationId.toString()}>
                        {s.station?.name ?? s.stationId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paste Items</Label>
                <p className="text-xs text-muted-foreground">
                  Format: itemName qty (one per line)
                </p>
                <Textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={8}
                  placeholder="Damage Control II 10&#10;Gyrostabilizer II 5&#10;..."
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}

          <Button
            onClick={onSubmit}
            disabled={
              sellAppraiseMutation.isPending ||
              sellAppraiseByCommitMutation.isPending ||
              (useCommit ? !cycleId : !destinationId)
            }
            className="gap-2"
          >
            {sellAppraiseMutation.isPending ||
            sellAppraiseByCommitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Appraise
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {groupedResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Appraisal Results</h2>
            {useCommit && (
              <Button
                onClick={onConfirmListed}
                disabled={isConfirming || !cycleId}
                className="gap-2"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Listed
                  </>
                )}
              </Button>
            )}
          </div>

          {groupedResults.map((group, gi) => (
            <Card key={gi}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  {group.stationName}
                </CardTitle>
                <CardDescription>
                  {group.items.length} item{group.items.length !== 1 ? "s" : ""}{" "}
                  ready to list
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SellAppraiserResultsTable
                  items={group.items}
                  selectionStore={selectionStore}
                  copiedKey={copiedKey}
                  onCopySuggestedPrice={copySuggestedPrice}
                  isCommitMode={useCommit}
                  brokerFeePct={BROKER_FEE_PCT}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
