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
  const [commitId, setCommitId] = useState<string>("");
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
    const fetchLatestCommit = async () => {
      try {
        const resp = await fetch("/api/arbitrage/commits?limit=1");
        if (!resp.ok) return;
        const rows: Array<{
          id: string;
          createdAt: string;
          memo?: string | null;
        }> = await resp.json();
        if (Array.isArray(rows) && rows.length > 0) {
          setCommitId(rows[0].id);
        }
      } catch {
        // ignore
      }
    };
    if (useCommit) fetchLatestCommit();
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
          body: JSON.stringify({ planCommitId: commitId || undefined }),
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

  const onConfirmListed = async () => {
    if (!useCommit || !commitId) return;
    const items: Array<{
      typeId: number;
      quantity: number;
      unitPrice: number;
    }> = [];
    for (const r of result ?? []) {
      const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
      if (!selected[key]) continue;
      if (isCommitRow(r)) {
        items.push({
          typeId: r.typeId,
          quantity: r.quantityRemaining,
          unitPrice: r.suggestedSellPriceTicked ?? 0,
        });
      } else {
        items.push({
          typeId: 0,
          quantity: r.quantity,
          unitPrice: r.suggestedSellPriceTicked ?? 0,
        });
      }
    }
    if (!items.length) return;
    const resp = await fetch("/api/pricing/confirm-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planCommitId: commitId,
        characterId: 0,
        stationId: destinationId ?? 0,
        items,
      }),
    });
    if (!resp.ok) setError(await resp.text());
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
          <Label htmlFor="use-commit">Use latest open commit</Label>
        </div>
        {!useCommit && (
          <div className="space-y-2">
            <Label>Commit Id</Label>
            <input
              className="border rounded p-2 w-full bg-background text-foreground"
              value={commitId}
              onChange={(e) => setCommitId(e.target.value)}
              placeholder="planCommitId"
            />
          </div>
        )}
        {useCommit && commitId && (
          <div className="text-sm text-muted-foreground">
            Using commit {commitId.slice(0, 8)}…
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
          disabled={loading || (useCommit ? !commitId : !destinationId)}
        >
          {loading ? "Computing..." : "Appraise"}
        </Button>
        <Button
          onClick={onConfirmListed}
          disabled={!useCommit || !commitId}
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
                <th className="py-2"></th>
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
