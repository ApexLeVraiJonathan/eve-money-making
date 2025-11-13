"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@eve/ui";
import { formatIsk } from "@/lib/utils";
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
  Package,
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
} from "../../api";

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

type PasteRow = {
  itemName: string;
  quantity: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
  typeId?: undefined;
  quantityRemaining?: undefined;
};

type CommitRow = {
  itemName: string;
  typeId: number;
  quantityRemaining: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
  quantity?: undefined;
};

type GroupedResult = {
  destinationStationId: number;
  stationName: string;
  items: Array<PasteRow | CommitRow>;
};

function isCommitRow(row: PasteRow | CommitRow): row is CommitRow {
  return (row as CommitRow).typeId !== undefined;
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  const BROKER_FEE_PCT = Number(process.env.NEXT_PUBLIC_BROKER_FEE_PCT ?? 1.5);

  // React Query hooks
  const { data: stations = [] } = useTrackedStations();
  const { data: latestCycles = [] } = useArbitrageCommits(
    { limit: 5 }, // Fetch a few cycles to ensure we can find the open one
    { enabled: useCommit },
  );
  const sellAppraiseMutation = useSellAppraise();
  const sellAppraiseByCommitMutation = useSellAppraiseByCommit();

  // Sort items alphabetically with EVE convention: numbers before letters
  const sortItems = (items: Array<PasteRow | CommitRow>) => {
    return items.sort((a, b) => {
      const nameA = a.itemName;
      const nameB = b.itemName;

      // Check if first character is a digit
      const startsWithDigitA = /^\d/.test(nameA);
      const startsWithDigitB = /^\d/.test(nameB);

      // If one starts with digit and other doesn't, digit comes first
      if (startsWithDigitA && !startsWithDigitB) return -1;
      if (!startsWithDigitA && startsWithDigitB) return 1;

      // Both start with same type (digit or letter), compare alphabetically
      return nameA.localeCompare(nameB, "en", {
        numeric: true,
        sensitivity: "base",
      });
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
    return groups;
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
        const data = await sellAppraiseByCommitMutation.mutateAsync({
          cycleId: cycleId || undefined,
        });
        setResult(data);
        // Default select all
        const allKeys = data.map(
          (r: PasteRow | CommitRow) =>
            `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`,
        );
        const initial: Record<string, boolean> = {};
        for (const k of allKeys) initial[k] = true;
        setSelected(initial);
      } else {
        if (!destinationId) return;
        const data = await sellAppraiseMutation.mutateAsync({
          destinationStationId: destinationId,
          lines,
        });
        setResult(data);
        // Default select all
        const allKeys = data.map(
          (r) => `${r.destinationStationId}:${r.itemName}`,
        );
        const initial: Record<string, boolean> = {};
        for (const k of allKeys) initial[k] = true;
        setSelected(initial);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleGroup = (group: GroupedResult, check: boolean) => {
    const keys = group.items.map(
      (r) =>
        `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`,
    );
    setSelected((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = check;
      return next;
    });
  };

  const onConfirmListed = async () => {
    if (!useCommit || !cycleId || !result) return;

    setIsConfirming(true);
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
      setIsConfirming(false);
      return;
    }

    const errors: string[] = [];
    const brokerFees: Array<{ lineId: string; amountIsk: string }> = [];
    const priceUpdates: Array<{ lineId: string; newPrice: string }> = [];

    for (const r of result) {
      const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
      if (!selected[key]) continue;
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
        newPrice: r.suggestedSellPriceTicked.toFixed(2),
      });
    }

    if (errors.length) {
      setError(errors.join("\n"));
      setIsConfirming(false);
      return;
    }

    // Add all broker fees in bulk
    try {
      const response = await fetch("/api/ledger/fees/broker/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees: brokerFees }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add broker fees: ${errorText}`);
      }
    } catch (e) {
      setError(
        `Failed to add broker fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      setIsConfirming(false);
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={
                              group.items.every((r) => {
                                const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
                                return selected[key];
                              }) && group.items.length > 0
                            }
                            onChange={(e) =>
                              toggleGroup(group, e.target.checked)
                            }
                          />
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-left">
                          Item
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Qty
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Lowest Sell
                        </th>
                        <th className="py-2 px-3 whitespace-nowrap text-right">
                          Suggested (ticked)
                        </th>
                        {useCommit && (
                          <th className="py-2 px-3 whitespace-nowrap text-right">
                            Broker Fee ({BROKER_FEE_PCT}%)
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((r, idx) => {
                        const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
                        const qty = isCommitRow(r)
                          ? r.quantityRemaining
                          : r.quantity;
                        const brokerFee =
                          r.suggestedSellPriceTicked !== null
                            ? qty *
                              r.suggestedSellPriceTicked *
                              (BROKER_FEE_PCT / 100)
                            : 0;
                        return (
                          <tr
                            key={idx}
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={!!selected[key]}
                                onChange={() => toggle(key)}
                              />
                            </td>
                            <td className="py-2 px-3 text-left whitespace-nowrap">
                              {r.itemName}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {qty}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {formatIsk(r.lowestSell)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium tabular-nums">
                              {formatIsk(r.suggestedSellPriceTicked)}
                            </td>
                            {useCommit && (
                              <td className="py-2 px-3 text-right font-medium tabular-nums">
                                {formatIsk(brokerFee)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {useCommit && (
                      <tfoot>
                        <tr className="border-t">
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3" colSpan={3}></td>
                          <td className="py-2 px-3 text-right font-medium">
                            Total broker fee (selected):
                          </td>
                          <td className="py-2 px-3 font-semibold text-right">
                            {formatIsk(
                              group.items.reduce((s, r) => {
                                const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
                                if (!selected[key]) return s;
                                const qty = isCommitRow(r)
                                  ? r.quantityRemaining
                                  : r.quantity;
                                const fee =
                                  r.suggestedSellPriceTicked !== null
                                    ? qty *
                                      r.suggestedSellPriceTicked *
                                      (BROKER_FEE_PCT / 100)
                                    : 0;
                                return s + fee;
                              }, 0),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
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
