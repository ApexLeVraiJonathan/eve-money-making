"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [staleness, setStaleness] = React.useState<Staleness | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [latestCycle, setLatestCycle] = React.useState<Cycle | null>(null);
  const [capital, setCapital] = React.useState<CapitalSnapshot | null>(null);
  const [wallets, setWallets] = React.useState<WalletBalance[] | null>(null);
  const [planning, setPlanning] = React.useState(false);
  const [opening, setOpening] = React.useState<string | null>(null);
  const [participations, setParticipations] = React.useState<
    Array<{
      id: string;
      characterName: string;
      amountIsk: string;
      status: string;
      memo: string;
    }>
  >([]);

  const formatISK = (value: number | string | null | undefined) => {
    const n =
      typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
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
        }),
      );
      setWallets(walletResults);

      // Load planned cycle participations (if a planned cycle exists)
      try {
        const allCyclesRes = await fetch("/api/ledger/cycles", {
          cache: "no-store",
        });
        const allCycles = (await allCyclesRes.json()) as Cycle[];
        const now = Date.now();
        const next = allCycles
          .filter((c) => new Date(c.startedAt).getTime() > now)
          .sort(
            (a, b) =>
              new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
          )[0];
        if (next) {
          const partsRes = await fetch(
            `/api/ledger/cycles/${next.id}/participations`,
            { cache: "no-store" },
          );
          const partsData = await partsRes.json();
          if (partsRes.ok) setParticipations(partsData as any[]);
        } else {
          setParticipations([]);
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  const handleAdminLogin = () => {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
    const returnUrl =
      typeof window !== "undefined" ? window.location.href : "/";
    window.location.href = `${base}/auth/login/admin?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  const [charFunction, setCharFunction] = React.useState<string>("SELLER");
  const [charLocation, setCharLocation] = React.useState<string>("JITA");
  const [selectedCharacterId, setSelectedCharacterId] =
    React.useState<string>("");

  return (
    <div className="container mx-auto max-w-6xl p-4 space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
          Error: {error}
        </div>
      )}
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
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div className="text-xl font-bold tabular-nums">
                {staleness ? staleness.missing.length : 0} Days
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">HTTP 200</CardTitle>
            <CardDescription className="text-muted-foreground">
              Requests
            </CardDescription>
          </CardHeader>
          <CardContent className="flex py-4">
            {loading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <div className="text-xl font-bold tabular-nums">
                {metrics ? metrics.http200 : 0}
              </div>
            )}
          </CardContent>
        </Card>
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
                    latestCycle.closedAt,
                  ).toLocaleDateString()}`
                : ""}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">Cash</CardTitle>
              {capital ? (
                <CardDescription>
                  {capital.capital.percentSplit.cash}%
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">
                  {capital ? formatISK(capital.capital.cash) : formatISK(0)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">Inventory</CardTitle>
              {capital ? (
                <CardDescription>
                  {capital.capital.percentSplit.inventory}%
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">
                  {capital
                    ? formatISK(capital.capital.inventory)
                    : formatISK(0)}
                </div>
              )}
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
                  {loading && !wallets ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    formatISK(w.balanceISK)
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cycle Planning */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Cycle Planning</h2>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
            disabled={planning}
            onClick={async () => {
              setPlanning(true);
              try {
                const start = new Date(
                  Date.now() + 10 * 24 * 60 * 60 * 1000,
                ).toISOString();
                const res = await fetch(`/api/ledger/cycles/plan`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: "Planned Cycle",
                    startedAt: start,
                  }),
                });
                if (!res.ok)
                  throw new Error((await res.json())?.error || res.statusText);
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setPlanning(false);
              }
            }}
          >
            {planning ? "Planning…" : "Plan Next Cycle"}
          </button>
          <button
            className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow hover:opacity-90"
            disabled={opening !== null}
            onClick={async () => {
              setOpening("pending");
              try {
                // Find earliest planned cycle
                const cyclesRes = await fetch(`/api/ledger/cycles`, {
                  cache: "no-store",
                });
                const cyclesData = (await cyclesRes.json()) as Cycle[];
                const now = Date.now();
                const next = cyclesData
                  .filter((c) => new Date(c.startedAt).getTime() > now)
                  .sort(
                    (a, b) =>
                      new Date(a.startedAt).getTime() -
                      new Date(b.startedAt).getTime(),
                  )[0];
                if (!next) throw new Error("No planned cycle to open");
                const res = await fetch(`/api/ledger/cycles/${next.id}/open`, {
                  method: "POST",
                });
                if (!res.ok)
                  throw new Error((await res.json())?.error || res.statusText);
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setOpening(null);
              }
            }}
          >
            {opening ? "Opening…" : "Open Next Planned"}
          </button>
        </div>
      </div>

      {/* Planned Cycle Participations */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Planned Participations</h2>
        <div className="rounded-md border surface-1">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
            <div>Character</div>
            <div>Amount</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          {participations.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No participations yet.
            </div>
          ) : (
            <div className="divide-y">
              {participations.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-4 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="truncate">{p.characterName}</div>
                  <div className="tabular-nums">{formatISK(p.amountIsk)}</div>
                  <div>{p.status}</div>
                  <div className="flex gap-2">
                    <button
                      className="h-8 rounded-md border px-2 text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/ledger/participations/${p.id}/validate`,
                            { method: "POST" },
                          );
                          if (!res.ok)
                            throw new Error(
                              (await res.json())?.error || res.statusText,
                            );
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Validate
                    </button>
                    <button
                      className="h-8 rounded-md border px-2 text-xs"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/ledger/participations/${p.id}/refund`,
                            {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ amountIsk: p.amountIsk }),
                            },
                          );
                          if (!res.ok)
                            throw new Error(
                              (await res.json())?.error || res.statusText,
                            );
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Refund
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Linking */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Admin Linking</h2>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Character</span>
            <Input
              className="h-9 w-48"
              placeholder="Character ID"
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Function</span>
            <Input
              className="h-9 w-40"
              placeholder="SELLER or BUYER"
              value={charFunction}
              onChange={(e) => setCharFunction(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Location</span>
            <Input
              className="h-9 w-40"
              placeholder="JITA, DODIXIE, ..."
              value={charLocation}
              onChange={(e) => setCharLocation(e.target.value.toUpperCase())}
            />
          </div>
          <Button onClick={handleAdminLogin}>Link Admin Character</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!selectedCharacterId) return;
              try {
                const res = await fetch(
                  `/api/auth/characters/${selectedCharacterId}`,
                  {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      role: "ADMIN",
                      function: charFunction,
                      location: charLocation,
                    }),
                  },
                );
                if (!res.ok)
                  throw new Error((await res.json())?.error || res.statusText);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Save Profile
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          After linking, you can enter the character ID and set
          function/location.
        </div>
      </div>
    </div>
  );
}
