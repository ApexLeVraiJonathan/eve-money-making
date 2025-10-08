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

export default function SellAppraiserPage() {
  const [stations, setStations] = useState<TrackedStation[]>([]);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<null | Array<{
    itemName: string;
    quantity: number;
    destinationStationId: number;
    lowestSell: number | null;
    suggestedSellPriceTicked: number | null;
  }>>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tracked-stations")
      .then((r) => r.json())
      .then((data) => {
        setStations(data ?? []);
        if (data?.length) {
          setDestinationId((prev) =>
            prev === null ? data[0].stationId : prev
          );
        }
      })
      .catch(() => {});
  }, [destinationId]);

  const lines = useMemo(() => paste.split(/\r?\n/).filter(Boolean), [paste]);

  const onSubmit = async () => {
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
      const data = await resp.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl min-w-4xl mx-auto space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Sell Appraiser</h1>
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
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={loading || !destinationId}>
          {loading ? "Computing..." : "Appraise"}
        </Button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {Array.isArray(result) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Lowest Sell</th>
                <th className="py-2">Suggested (ticked)</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-1 pr-2">{r.itemName}</td>
                  <td className="py-1 pr-2">{r.quantity}</td>
                  <td className="py-1 pr-2">{formatIsk(r.lowestSell)}</td>
                  <td className="py-1 pr-2 font-medium">
                    {formatIsk(r.suggestedSellPriceTicked)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
