"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatIsk } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Store,
  Package,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [stations, setStations] = useState<TrackedStation[]>([]);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<Array<PasteRow | CommitRow> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const BROKER_FEE_PCT = Number(process.env.NEXT_PUBLIC_BROKER_FEE_PCT ?? 1.5);

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
        items,
      });
    }
    return groups;
  }, [result, stations]);

  useEffect(() => {
    fetch("/api/tracked-stations")
      .then((r) => r.json())
      .then((data) => {
        setStations(data ?? []);
        if (data?.length) {
          setDestinationId((prev) =>
            prev === null ? data[0].stationId : prev,
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchLatestCycle = async () => {
      try {
        const resp = await fetch("/api/arbitrage/commits?limit=1");
        if (!resp.ok) return;
        const rows: Array<{
          id: string;
          createdAt: string;
          name?: string | null;
          closedAt?: Date | null;
        }> = await resp.json();
        const openCycle = rows.find((r) => !r.closedAt);
        if (openCycle) {
          setCycleId(openCycle.id);
        } else if (rows.length > 0) {
          setCycleId(rows[0].id);
        }
      } catch {
        // ignore
      }
    };
    if (useCommit) fetchLatestCycle();
  }, [useCommit]);

  const lines = useMemo(() => paste.split(/\r?\n/).filter(Boolean), [paste]);

  const onSubmit = async () => {
    if (useCommit) {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const resp = await fetch("/api/pricing/sell-appraise-by-commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleId: cycleId || undefined }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        setResult(data);
        // Default select all
        const allKeys = data.map(
          (r: PasteRow | CommitRow) =>
            `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`,
        );
        const initial: Record<string, boolean> = {};
        for (const k of allKeys) initial[k] = true;
        setSelected(initial);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!destinationId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/pricing/sell-appraise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationStationId: destinationId, lines }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as Array<PasteRow>;
      setResult(data);
      // Default select all
      const allKeys = data.map(
        (r) => `${r.destinationStationId}:${r.itemName}`,
      );
      const initial: Record<string, boolean> = {};
      for (const k of allKeys) initial[k] = true;
      setSelected(initial);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
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

    setConfirmLoading(true);
    setError(null);

    // Need to get cycle lines to match typeIds to lineIds
    let cycleLines: CycleLine[];
    try {
      const resp = await fetch(`/api/ledger/cycles/${cycleId}/lines`);
      if (!resp.ok) {
        throw new Error(`Failed to fetch cycle lines: ${resp.statusText}`);
      }
      cycleLines = await resp.json();
    } catch (e) {
      setError(
        `Failed to fetch cycle lines: ${e instanceof Error ? e.message : String(e)}`,
      );
      setConfirmLoading(false);
      return;
    }

    const errors: string[] = [];
    const promises: Promise<void>[] = [];

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

      // Execute all API calls in parallel
      promises.push(
        fetch("/api/pricing/confirm-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineId: line.id,
            quantity: r.quantityRemaining,
            unitPrice: r.suggestedSellPriceTicked,
          }),
        })
          .then(async (resp) => {
            if (!resp.ok) {
              const text = await resp.text();
              errors.push(`${r.itemName}: ${text}`);
            }
          })
          .catch((e) => {
            errors.push(
              `${r.itemName}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }),
      );
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    setConfirmLoading(false);

    if (errors.length) {
      setError(errors.join("\n"));
    } else {
      setError(null);
      alert(
        "Broker fees recorded and current sell prices updated successfully!",
      );
    }
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
            disabled={loading || (useCommit ? !cycleId : !destinationId)}
            className="gap-2"
          >
            {loading ? (
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
                disabled={confirmLoading || !cycleId}
                className="gap-2"
              >
                {confirmLoading ? (
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
