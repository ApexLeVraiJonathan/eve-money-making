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
  const [commitId, setCommitId] = useState<string>("");
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

  const onRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let cid = commitId;
      if (useCommit && !cid) {
        try {
          const respLatest = await fetch("/api/arbitrage/commits?limit=1");
          if (respLatest.ok) {
            const rows: Array<{ id: string }> = await respLatest.json();
            if (Array.isArray(rows) && rows.length > 0) {
              cid = rows[0].id;
              setCommitId(cid);
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
          planCommitId: useCommit ? cid || undefined : undefined,
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
    const updates: Array<{
      orderId: number;
      typeId: number;
      remaining: number;
      newUnitPrice: number;
    }> = [];
    for (const g of result ?? []) {
      for (const u of g.updates) {
        const key = `${g.characterId}:${g.stationId}:${u.orderId}`;
        if (selected[key]) {
          updates.push({
            orderId: u.orderId,
            typeId: u.typeId,
            remaining: u.remaining,
            newUnitPrice: u.suggestedNewPriceTicked,
          });
        }
      }
    }
    if (!commitId || !updates.length) return;
    const resp = await fetch("/api/pricing/confirm-reprice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planCommitId: commitId,
        characterId: 0,
        stationId: 0,
        updates,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      setError(txt || "Confirm failed");
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
        <Button onClick={onRun} disabled={loading || (useCommit && !commitId)}>
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
              disabled={!useCommit || !commitId}
            >
              Confirm Repriced
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
