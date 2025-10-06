"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

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

type Cycle = {
  id: string;
  name?: string | null;
  startedAt: string;
  closedAt?: string | null;
};

type CapitalSnapshot = {
  cycleId: string;
  asOf: string;
  capital: {
    total: string;
    cash: string;
    inventory: string;
    percentSplit: { cash: number; inventory: number };
  };
};

type WalletBalance = { characterId: number; name: string; balanceISK: number };

export default function AdminPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [staleness, setStaleness] = React.useState<Staleness | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [latestCycle, setLatestCycle] = React.useState<Cycle | null>(null);
  const [capital, setCapital] = React.useState<CapitalSnapshot | null>(null);
  const [wallets, setWallets] = React.useState<WalletBalance[] | null>(null);

  const formatISK = (value: number | string | null | undefined) => {
    const n = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ISK",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(n)
      .replace("ISK", "ISK");
  };

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

      // Load latest cycle and its capital snapshot
      const cyclesRes = await fetch("/api/ledger/cycles", {
        cache: "no-store",
      });
      const cyclesData = (await cyclesRes.json()) as Cycle[];
      if (cyclesRes.ok && Array.isArray(cyclesData) && cyclesData.length > 0) {
        const latest = cyclesData[0];
        setLatestCycle(latest);
        const capRes = await fetch(`/api/ledger/cycles/${latest.id}/capital`, {
          cache: "no-store",
        });
        const capData = (await capRes.json()) as CapitalSnapshot;
        if (capRes.ok) setCapital(capData);
      }

      // Load specific character wallet balances with display names
      const characters = [
        { id: 2122406821, name: "LeVraiMindTrader01" },
        { id: 2122406910, name: "LeVraiMindTrader02" },
        { id: 2122406955, name: "LeVraiMindTrader03" },
        { id: 2122471041, name: "LeVraiMindTrader04" },
      ];
      const walletResults = await Promise.all(
        characters.map(async ({ id, name }) => {
          try {
            const wRes = await fetch(`/api/auth/wallet?characterId=${id}`, {
              cache: "no-store",
            });
            const wData = await wRes.json();
            return wRes.ok
              ? ({
                  characterId: id,
                  name,
                  balanceISK: Number(wData.balanceISK),
                } as WalletBalance)
              : ({ characterId: id, name, balanceISK: 0 } as WalletBalance);
          } catch {
            return { characterId: id, name, balanceISK: 0 } as WalletBalance;
          }
        })
      );
      setWallets(walletResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="container mx-auto max-w-6xl p-4 space-y-4">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="py-4 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">
              Trade Data Missing
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Days
            </CardDescription>
          </CardHeader>
          <CardContent className="flex py-4">
            <div className="text-xl font-bold tabular-nums">
              {staleness ? staleness.missing.length : loading ? "…" : 0} Days
            </div>
          </CardContent>
        </Card>
        {/* Add more small cards here as needed */}
      </div>

      {/* Latest Cycle Overview */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Latest Cycle{latestCycle?.name ? `: ${latestCycle.name}` : ""}
          </h2>
          {latestCycle && (
            <div className="text-xs text-muted-foreground">
              started {new Date(latestCycle.startedAt).toLocaleDateString()}
              {latestCycle.closedAt
                ? ` • closed ${new Date(
                    latestCycle.closedAt
                  ).toLocaleDateString()}`
                : ""}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">Cash</CardTitle>
              {capital && (
                <CardDescription>
                  {capital.capital.percentSplit.cash}%
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {capital
                  ? formatISK(capital.capital.cash)
                  : loading
                  ? "…"
                  : formatISK(0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">Inventory</CardTitle>
              {capital && (
                <CardDescription>
                  {capital.capital.percentSplit.inventory}%
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {capital
                  ? formatISK(capital.capital.inventory)
                  : loading
                  ? "…"
                  : formatISK(0)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Character Balances */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Character Wallets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(
            wallets ?? [
              {
                characterId: 2122406821,
                name: "LeVraiMindTrader01",
                balanceISK: 0,
              },
              {
                characterId: 2122406910,
                name: "LeVraiMindTrader02",
                balanceISK: 0,
              },
              {
                characterId: 2122406955,
                name: "LeVraiMindTrader03",
                balanceISK: 0,
              },
              {
                characterId: 2122471041,
                name: "LeVraiMindTrader04",
                balanceISK: 0,
              },
            ]
          ).map((w) => (
            <Card key={w.characterId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold">{w.name}</CardTitle>
                <CardDescription>Current Balance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold tabular-nums">
                  {loading && !wallets ? "…" : formatISK(w.balanceISK)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
