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

export default function UndercutCheckerPage() {
  const [stations, setStations] = useState<TrackedStation[]>([]);
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const RELIST_PCT = Number(process.env.NEXT_PUBLIC_BROKER_RELIST_PCT ?? 0.3);

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

  useEffect(() => {
    fetch("/api/tracked-stations")
      .then((r) => r.json())
      .then((data) => setStations(data ?? []))
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

  const onRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let cid = cycleId;
      if (useCommit && !cid) {
        try {
          const respLatest = await fetch("/api/arbitrage/commits?limit=1");
          if (respLatest.ok) {
            const rows: Array<{ id: string; closedAt?: Date | null }> =
              await respLatest.json();
            const openCycle = rows.find((r) => !r.closedAt);
            if (openCycle) {
              cid = openCycle.id;
              setCycleId(cid);
            } else if (rows.length > 0) {
              cid = rows[0].id;
              setCycleId(cid);
            }
          }
        } catch {
          // ignore
        }
      }
      const resp = await fetch("/api/pricing/undercut-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationIds: useCommit
            ? undefined
            : selectedStations.length
              ? selectedStations
              : undefined,
          cycleId: useCommit ? cid || undefined : undefined,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as Group[];
      setResult(data);
      // Default select all items
      const allKeys = buildKeys(data);
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

  const onConfirmReprice = async () => {
    if (!cycleId || !result) return;

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

        // Execute all API calls in parallel
        promises.push(
          fetch("/api/pricing/confirm-reprice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lineId: line.id,
              quantity: u.remaining,
              newUnitPrice: u.suggestedNewPriceTicked,
            }),
          })
            .then(async (resp) => {
              if (!resp.ok) {
                errors.push(`${u.itemName}: ${await resp.text()}`);
              }
            })
            .catch((e) => {
              errors.push(
                `${u.itemName}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }),
        );
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    if (errors.length) {
      setError(errors.join("\n"));
    } else {
      setError(null);
      alert("Relist fees recorded successfully!");
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto  space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Undercut Checker</h1>
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
                          : prev.filter((id) => id !== s.stationId),
                      );
                    }}
                  />
                  <span>{s.station?.name ?? s.stationId}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <Button onClick={onRun} disabled={loading || (useCommit && !cycleId)}>
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
            </div>
          ))}
          <div>
            <Button
              onClick={onConfirmReprice}
              disabled={!useCommit || !cycleId}
            >
              Confirm Repriced
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
