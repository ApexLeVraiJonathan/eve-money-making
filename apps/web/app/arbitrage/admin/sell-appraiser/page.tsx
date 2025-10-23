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
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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
  }, [destinationId]);

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
        // Get the first open cycle (not closed)
        const openCycle = rows.find((r) => !r.closedAt);
        if (openCycle) {
          setCycleId(openCycle.id);
        } else if (rows.length > 0) {
          // Fallback to most recent cycle if no open one
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
      const commitData = (await resp.json()) as Array<CommitRow>;
      setResult(commitData);
      const pasteData = (await resp.json()) as Array<PasteRow>;
      setResult(pasteData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAll = () => {
    if (!result) return;
    const allKeys = result.map(
      (r) =>
        `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`,
    );
    const allSelected = allKeys.every((k) => selected[k]);
    const next: Record<string, boolean> = {};
    for (const k of allKeys) {
      next[k] = !allSelected;
    }
    setSelected(next);
  };

  const onConfirmListed = async () => {
    if (!useCommit || !cycleId || !result) return;

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
      return;
    }

    const errors: string[] = [];
    const promises: Promise<void>[] = [];

    for (const r of result) {
      const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
      if (!selected[key]) continue;
      if (!isCommitRow(r)) continue; // Skip paste rows

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
            unitPrice: r.suggestedSellPriceTicked ?? 0,
          }),
        })
          .then(async (resp) => {
            if (!resp.ok) {
              errors.push(`${r.itemName}: ${await resp.text()}`);
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

    if (errors.length) {
      setError(errors.join("\n"));
    } else {
      setError(null);
      alert("Broker fees recorded successfully!");
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

          <div className="flex gap-2">
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
            <Button
              onClick={onConfirmListed}
              disabled={!useCommit || !cycleId}
              variant="secondary"
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Listed
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {Array.isArray(result) && result.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Appraisal Results
            </CardTitle>
            <CardDescription>
              {result.length} item{result.length !== 1 ? "s" : ""} ready to list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-3 px-3">
                      <Checkbox
                        checked={
                          result.length > 0 &&
                          result.every((r) => {
                            const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
                            return selected[key];
                          })
                        }
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="py-3 px-3 text-left font-medium">Item</th>
                    <th className="py-3 px-3 text-right font-medium">Qty</th>
                    <th className="py-3 px-3 text-right font-medium">
                      Lowest Sell
                    </th>
                    <th className="py-3 px-3 text-right font-medium">
                      Suggested (ticked)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((r, idx) => {
                    const key = `${r.destinationStationId}:${"typeId" in r ? r.typeId : r.itemName}`;
                    return (
                      <tr
                        key={idx}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2 px-3">
                          <Checkbox
                            checked={!!selected[key]}
                            onCheckedChange={() => toggle(key)}
                          />
                        </td>
                        <td className="py-2 px-3">{r.itemName}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {"quantity" in r ? r.quantity : r.quantityRemaining}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {formatIsk(r.lowestSell)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">
                          {formatIsk(r.suggestedSellPriceTicked)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
