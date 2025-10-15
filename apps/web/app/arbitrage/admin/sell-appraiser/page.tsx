"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatIsk } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
//

type TrackedStation = {
  id: string;
  stationId: number;
  station: { name: string };
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
    let cycleLines;
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
    <div className="max-w-4xl min-w-4xl mx-auto space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Sell Appraiser</h1>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="use-commit"
            type="checkbox"
            checked={useCommit}
            onChange={(e) => setUseCommit(e.target.checked)}
          />
          <Label htmlFor="use-commit">Use latest open cycle</Label>
        </div>
        {!useCommit && (
          <div className="space-y-2">
            <Label>Cycle Id</Label>
            <input
              className="border rounded p-2 w-full bg-background text-foreground"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              placeholder="cycleId"
            />
          </div>
        )}
        {useCommit && cycleId && (
          <div className="text-sm text-muted-foreground">
            Using cycle {cycleId.slice(0, 8)}…
          </div>
        )}
      </div>
      {!useCommit && (
        <>
          <div className="space-y-2">
            <Label>Destination</Label>
            <select
              className="border rounded p-2 w-full bg-background text-foreground"
              value={destinationId ?? ""}
              onChange={(e) => setDestinationId(Number(e.target.value))}
            >
              {stations.map((s) => (
                <option key={s.id} value={s.stationId}>
                  {s.station?.name ?? s.stationId}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Paste items (format: itemName qty, one per line)</Label>
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={8}
            />
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Button
          onClick={onSubmit}
          disabled={loading || (useCommit ? !cycleId : !destinationId)}
        >
          {loading ? "Computing..." : "Appraise"}
        </Button>
        <Button
          onClick={onConfirmListed}
          disabled={!useCommit || !cycleId}
          variant="secondary"
        >
          Confirm Listed
        </Button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {Array.isArray(result) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">
                  <input
                    type="checkbox"
                    checked={
                      result.length > 0 &&
                      result.every((r) => {
                        const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
                        return selected[key];
                      })
                    }
                    onChange={toggleAll}
                  />
                </th>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Lowest Sell</th>
                <th className="py-2">Suggested (ticked)</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r, idx) => {
                const key = `${r.destinationStationId}:${"typeId" in r ? r.typeId : r.itemName}`;
                return (
                  <tr key={idx} className="border-b">
                    <td className="py-1 pr-2">
                      <input
                        type="checkbox"
                        checked={!!selected[key]}
                        onChange={() => toggle(key)}
                      />
                    </td>
                    <td className="py-1 pr-2">{r.itemName}</td>
                    <td className="py-1 pr-2">
                      {"quantity" in r ? r.quantity : r.quantityRemaining}
                    </td>
                    <td className="py-1 pr-2">{formatIsk(r.lowestSell)}</td>
                    <td className="py-1 pr-2 font-medium">
                      {formatIsk(r.suggestedSellPriceTicked)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
