"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = {
  cacheHitMem: number;
  cacheHitDb: number;
  cacheMiss: number;
  http200: number;
  http304: number;
  http401: number;
  http420: number;
  memCacheSize: number;
  inflightSize: number;
  effectiveMaxConcurrency: number;
  errorRemain: number | null;
  errorResetAt: number | null;
};

type Staleness = { missing: string[] };

export default function AdminPage() {
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [staleness, setStaleness] = React.useState<Staleness | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cleanupMsg, setCleanupMsg] = React.useState<string | null>(null);
  const [backfillMsg, setBackfillMsg] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setMetrics(data as Metrics);
      const sRes = await fetch("/api/jobs/staleness", { cache: "no-store" });
      const sData = await sRes.json();
      if (sRes.ok) setStaleness(sData as Staleness);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  const runCleanup = async () => {
    setCleanupMsg(null);
    try {
      const res = await fetch("/api/jobs/esi-cache/cleanup", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setCleanupMsg(`Deleted ${data?.deleted ?? 0} cache rows`);
      await load();
    } catch (e) {
      setCleanupMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const runBackfill = async () => {
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/import/market-trades/missing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daysBack: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setBackfillMsg("Backfill started/completed");
      await load();
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ESI Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button onClick={() => void runCleanup()}>
              Purge expired cache
            </Button>
            <Button onClick={() => void runBackfill()}>
              Backfill missing trades
            </Button>
          </div>
          {cleanupMsg && (
            <div className="text-xs text-muted-foreground">{cleanupMsg}</div>
          )}
          {backfillMsg && (
            <div className="text-xs text-muted-foreground">{backfillMsg}</div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          {staleness && (
            <div className="text-xs text-muted-foreground">
              Missing daily files (last 15 days): {staleness.missing.length}
              {staleness.missing.length > 0 && (
                <span>
                  {" "}
                  — latest missing:{" "}
                  {staleness.missing[staleness.missing.length - 1]}
                </span>
              )}
            </div>
          )}
          {!metrics ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>Mem hits: {metrics.cacheHitMem}</div>
              <div>DB hits: {metrics.cacheHitDb}</div>
              <div>Misses: {metrics.cacheMiss}</div>
              <div>200: {metrics.http200}</div>
              <div>304: {metrics.http304}</div>
              <div>401: {metrics.http401}</div>
              <div>420: {metrics.http420}</div>
              <div>Mem cache size: {metrics.memCacheSize}</div>
              <div>Inflight: {metrics.inflightSize}</div>
              <div>Concurrency: {metrics.effectiveMaxConcurrency}</div>
              <div>Error remain: {metrics.errorRemain ?? "-"}</div>
              <div>Error reset: {metrics.errorResetAt ?? "-"}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
