"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Cycle = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
};

export default function CyclesPage() {
  const [cycles, setCycles] = React.useState<Cycle[]>([]);
  const [name, setName] = React.useState("");
  const [initialInjection, setInitialInjection] = React.useState<string>("");
  const [planStart, setPlanStart] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [capital, setCapital] = React.useState<null | {
    cycleId: string;
    asOf: string;
    capital: {
      total: string;
      cash: string;
      inventory: string;
      percentSplit: { cash: number; inventory: number };
    };
    initialInvestment: string | null;
    inventoryBreakdown: Array<{
      stationId: number;
      stationName: string;
      value: string;
    }>;
    notes: string[];
  }>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await fetch("/api/ledger/cycles", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setCycles(data as Cycle[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  const loadCapital = async (cycleId: string, force?: boolean) => {
    try {
      const res = await fetch(
        `/api/ledger/cycles/${cycleId}/capital${force ? `?force=true` : ""}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setCapital(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startCycle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ledger/cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          startedAt: new Date().toISOString(),
          initialInjectionIsk:
            initialInjection && !Number.isNaN(Number(initialInjection))
              ? Number(initialInjection).toFixed(2)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setName("");
      setInitialInjection("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const planCycle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ledger/cycles/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          startedAt: planStart
            ? new Date(planStart).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          initialInjectionIsk:
            initialInjection && !Number.isNaN(Number(initialInjection))
              ? Number(initialInjection).toFixed(2)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setName("");
      setInitialInjection("");
      setPlanStart("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const closeCycle = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ledger/cycles/${id}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const openPlanned = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ledger/cycles/${id}/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (c: Cycle): "Planned" | "Ongoing" | "Completed" => {
    const now = Date.now();
    const start = new Date(c.startedAt).getTime();
    if (start > now) return "Planned";
    if (c.closedAt) return "Completed";
    return "Ongoing";
  };

  return (
    <div className="container mx-auto max-w-8xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 p-3 rounded-md border">
              <div className="font-medium">Plan a Cycle</div>
              <div className="text-xs text-muted-foreground mb-2">
                Creates a cycle for future opt-ins (defaults to tomorrow if date
                not set)
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Optional name (e.g. Cycle 6)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  type="datetime-local"
                  placeholder="Future start date/time"
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                />
                <Input
                  placeholder="Initial injection ISK"
                  value={initialInjection}
                  onChange={(e) => setInitialInjection(e.target.value)}
                />
                <Button onClick={() => void planCycle()} disabled={loading}>
                  Plan
                </Button>
              </div>
            </div>
            <div className="space-y-2 p-3 rounded-md border">
              <div className="font-medium">Start a Cycle Now</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Optional name (e.g. Cycle 6)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="Initial injection ISK"
                  value={initialInjection}
                  onChange={(e) => setInitialInjection(e.target.value)}
                />
                <Button onClick={() => void startCycle()} disabled={loading}>
                  Start
                </Button>
              </div>
            </div>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cycles.length === 0 ? (
            <div className="text-sm text-muted-foreground">No cycles yet.</div>
          ) : (
            <div className="space-y-2">
              {cycles.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {c.name || c.id.slice(0, 8)}
                      <span className="ml-2">
                        {(() => {
                          const status = getStatus(c);
                          return (
                            <Badge
                              variant={
                                status === "Planned"
                                  ? "outline"
                                  : status === "Completed"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {status}
                            </Badge>
                          );
                        })()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {new Date(c.startedAt).toLocaleString()}
                      {c.closedAt &&
                        ` • Closed ${new Date(c.closedAt).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatus(c) === "Planned" && (
                      <Button
                        variant="secondary"
                        onClick={() => void openPlanned(c.id)}
                        disabled={loading}
                      >
                        Open now
                      </Button>
                    )}
                    {getStatus(c) === "Ongoing" && (
                      <Button
                        variant="secondary"
                        onClick={() => void closeCycle(c.id)}
                        disabled={loading}
                      >
                        Close
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => void loadCapital(c.id)}
                      disabled={loading}
                    >
                      View Capital
                    </Button>
                    <button
                      className="px-2 py-1 text-xs rounded border"
                      onClick={() => navigator.clipboard.writeText(c.id)}
                      title={c.id}
                    >
                      Copy ID
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {capital && (
        <Card>
          <CardHeader>
            <CardTitle>Capital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-4">
              <div>
                Total: {Number(capital.capital.total).toLocaleString()} ISK
              </div>
              <div>
                Cash: {Number(capital.capital.cash).toLocaleString()} ISK
              </div>
              <div>
                Inventory: {Number(capital.capital.inventory).toLocaleString()}{" "}
                ISK
              </div>
              <Button
                variant="secondary"
                onClick={() => void loadCapital(capital.cycleId, true)}
              >
                Recompute
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              As of {new Date(capital.asOf).toLocaleString()} • Split: Cash{" "}
              {capital.capital.percentSplit.cash}% / Inventory{" "}
              {capital.capital.percentSplit.inventory}% • Initial Investment:{" "}
              {capital.initialInvestment ?? "—"}
            </div>
            <div className="mt-2">
              <div className="font-medium">Inventory by station</div>
              <div className="grid grid-cols-1 gap-1">
                {capital.inventoryBreakdown.map((b) => (
                  <div key={b.stationId} className="flex justify-between">
                    <span>
                      {b.stationName} (#{b.stationId})
                    </span>
                    <span>{Number(b.value).toLocaleString()} ISK</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
