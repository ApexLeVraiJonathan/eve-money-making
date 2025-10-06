"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatIsk } from "@/lib/utils";

type Group = {
  characterId: number;
  characterName: string;
  stationId: number;
  stationName: string;
  updates: Array<{
    orderId: number;
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

export default function UndercutCheckerPage() {
  const [stations, setStations] = useState<TrackedStation[]>([]);
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tracked-stations")
      .then((r) => r.json())
      .then((data) => setStations(data ?? []))
      .catch(() => {});
  }, []);

  const onRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/pricing/undercut-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationIds: selectedStations.length ? selectedStations : undefined,
        }),
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
    <div className="max-w-4xl mx-auto space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Undercut Checker</h1>
      <div className="space-y-2">
        <Label>Stations</Label>
        <div className="flex flex-wrap gap-2">
          {stations.map((s) => {
            const checked = selectedStations.includes(s.stationId);
            return (
              <label
                key={s.id}
                className="flex items-center gap-2 border rounded px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setSelectedStations((prev) =>
                      e.target.checked
                        ? [...prev, s.stationId]
                        : prev.filter((id) => id !== s.stationId)
                    );
                  }}
                />
                <span>{s.station?.name ?? s.stationId}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Button onClick={onRun} disabled={loading}>
          {loading ? "Checking..." : "Run Check"}
        </Button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {Array.isArray(result) && result.length > 0 && (
        <div className="space-y-6">
          {result.map((group, gi) => (
            <div key={gi} className="border rounded p-3">
              <div className="font-medium mb-2">
                Character {group.characterName ?? group.characterId} — Station{" "}
                {group.stationName ?? group.stationId}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Item</th>
                      <th className="py-2">Remain</th>
                      <th className="py-2">Current</th>
                      <th className="py-2">Competitor Lowest</th>
                      <th className="py-2">Suggested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.updates.map((u, ui) => (
                      <tr key={ui} className="border-b">
                        <td className="py-1 pr-2">{u.itemName}</td>
                        <td className="py-1 pr-2">{u.remaining}</td>
                        <td className="py-1 pr-2">
                          {formatIsk(u.currentPrice)}
                        </td>
                        <td className="py-1 pr-2">
                          {formatIsk(u.competitorLowest)}
                        </td>
                        <td className="py-1 pr-2 font-medium">
                          {formatIsk(u.suggestedNewPriceTicked)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
