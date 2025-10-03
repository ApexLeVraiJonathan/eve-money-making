"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Cycle = {
  id: string;
  name: string | null;
  startedAt: string;
  closedAt: string | null;
};

export default function CyclesPage() {
  const [cycles, setCycles] = React.useState<Cycle[]>([]);
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setName("");
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

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Start a Cycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Optional name (e.g. Cycle 6)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={() => void startCycle()} disabled={loading}>
              Start
            </Button>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cycles</CardTitle>
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
                      {c.closedAt ? " (closed)" : " (open)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {new Date(c.startedAt).toLocaleString()}
                      {c.closedAt &&
                        ` • Closed ${new Date(c.closedAt).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.closedAt && (
                      <Button
                        variant="secondary"
                        onClick={() => void closeCycle(c.id)}
                        disabled={loading}
                      >
                        Close
                      </Button>
                    )}
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
    </div>
  );
}
