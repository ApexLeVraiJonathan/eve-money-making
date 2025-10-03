"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PlanItem = {
  typeId: number;
  name: string;
  units: number;
  unitCost: number;
  unitProfit: number;
  unitVolume: number;
  spendISK: number;
  profitISK: number;
  volumeM3: number;
};

type PackagePlan = {
  packageIndex: number;
  destinationStationId: number;
  destinationName?: string;
  items: PlanItem[];
  spendISK: number;
  grossProfitISK: number;
  shippingISK: number;
  netProfitISK: number;
  usedCapacityM3: number;
  efficiency: number;
};

type PlanResult = {
  packages: PackagePlan[];
  totalSpendISK: number;
  totalGrossProfitISK: number;
  totalShippingISK: number;
  totalNetProfitISK: number;
  itemExposureByDest: Record<
    number,
    Record<number, { spendISK: number; units: number }>
  >;
  destSpend: Record<number, number>;
  notes: string[];
};

const defaultPayload = {
  shippingCostByStation: {
    60008494: 45000000,
    60005686: 19000000,
    60011866: 15000000,
    60004588: 25000000,
  },
  packageCapacityM3: 60000,
  investmentISK: 10_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.2,
  maxPackagesHint: 20,
  allocation: { mode: "best" as const },
};

function formatISK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ISK",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace("ISK", "ISK");
}

export default function HomePage() {
  const [json, setJson] = React.useState(
    JSON.stringify(defaultPayload, null, 2)
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PlanResult | null>(null);
  const [memo, setMemo] = React.useState("");

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const payload = JSON.parse(json);
      const res = await fetch("/api/plan-packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || res.statusText);
      setData(body as PlanResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Group packages by destination
  const groupedByDest = React.useMemo(() => {
    if (!data) return {} as Record<string, PackagePlan[]>;
    return data.packages.reduce<Record<string, PackagePlan[]>>((acc, pkg) => {
      const key = String(pkg.destinationStationId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(pkg);
      return acc;
    }, {});
  }, [data]);

  // Aggregate items per destination (sum units of identical items)
  const aggregatedItemsByDest = React.useMemo(() => {
    const out: Record<
      string,
      Array<{ typeId: number; name: string; units: number }>
    > = {};
    for (const [dest, pkgs] of Object.entries(groupedByDest)) {
      const map = new Map<
        string,
        { typeId: number; name: string; units: number }
      >();
      for (const p of pkgs) {
        for (const it of p.items) {
          const key = `${it.typeId}|${it.name}`;
          const existing = map.get(key);
          if (existing) existing.units += it.units;
          else
            map.set(key, { typeId: it.typeId, name: it.name, units: it.units });
        }
      }
      out[dest] = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }
    return out;
  }, [groupedByDest]);

  // Build copy lists by destination from aggregated items
  const copyTextByDest = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const [dest, items] of Object.entries(aggregatedItemsByDest)) {
      map[dest] = items.map((it) => `${it.name}\t${it.units}`).join("\n");
    }
    return map;
  }, [aggregatedItemsByDest]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Arbitrage Package Planner</CardTitle>
          <CardDescription>
            Trigger the planner and tweak parameters. Results will show by
            destination.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="payload">Request JSON</Label>
              <Textarea
                id="payload"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className="font-mono text-xs min-h-64"
              />
            </div>
            <div className="space-y-2">
              <Label>Quick params</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="capacity" className="text-xs">
                    Capacity m³
                  </Label>
                  <Input
                    id="capacity"
                    type="number"
                    defaultValue={defaultPayload.packageCapacityM3}
                    onChange={(e) => {
                      try {
                        const j = JSON.parse(json);
                        j.packageCapacityM3 = Number(e.target.value);
                        setJson(JSON.stringify(j, null, 2));
                      } catch {}
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="investment" className="text-xs">
                    Investment ISK
                  </Label>
                  <Input
                    id="investment"
                    type="number"
                    defaultValue={defaultPayload.investmentISK}
                    onChange={(e) => {
                      try {
                        const j = JSON.parse(json);
                        j.investmentISK = Number(e.target.value);
                        setJson(JSON.stringify(j, null, 2));
                      } catch {}
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="maxPackages" className="text-xs">
                    Max packages
                  </Label>
                  <Input
                    id="maxPackages"
                    type="number"
                    defaultValue={defaultPayload.maxPackagesHint}
                    onChange={(e) => {
                      try {
                        const j = JSON.parse(json);
                        j.maxPackagesHint = Number(e.target.value);
                        setJson(JSON.stringify(j, null, 2));
                      } catch {}
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="share" className="text-xs">
                    Per-item share
                  </Label>
                  <Input
                    id="share"
                    type="number"
                    step="0.01"
                    defaultValue={
                      defaultPayload.perDestinationMaxBudgetSharePerItem
                    }
                    onChange={(e) => {
                      try {
                        const j = JSON.parse(json);
                        j.perDestinationMaxBudgetSharePerItem = Number(
                          e.target.value
                        );
                        setJson(JSON.stringify(j, null, 2));
                      } catch {}
                    }}
                  />
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Planning..." : "Run planner"}
              </Button>
              <div className="space-y-1 pt-2">
                <Label htmlFor="memo">Commit memo (optional)</Label>
                <Input
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={!data}
                  onClick={async () => {
                    if (!data) return;
                    try {
                      const payload = JSON.parse(json);
                      const res = await fetch("/api/arbitrage/commit", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          request: payload,
                          result: data,
                          memo: memo || undefined,
                        }),
                      });
                      const body = await res.json();
                      if (!res.ok)
                        throw new Error(body?.error || res.statusText);
                      alert(`Plan committed: ${body.id}`);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="w-full"
                >
                  Commit plan
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Totals and notes</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total Spend</div>
                <div className="font-medium">
                  {formatISK(data.totalSpendISK)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Gross Profit</div>
                <div className="font-medium">
                  {formatISK(data.totalGrossProfitISK)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Shipping</div>
                <div className="font-medium">
                  {formatISK(data.totalShippingISK)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Net Profit</div>
                <div className="font-medium">
                  {formatISK(data.totalNetProfitISK)}
                </div>
              </div>
              <div className="md:col-span-4 mt-2">
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {data.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Packages by destination */}
          <div className="space-y-4">
            {Object.values(groupedByDest).map((pkgs, idx) => {
              const destId = pkgs[0].destinationStationId;
              const destName = pkgs[0].destinationName || `Station ${destId}`;
              const copyText = copyTextByDest[String(destId)] || "";
              const aggItems = aggregatedItemsByDest[String(destId)] || [];
              return (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle>{destName}</CardTitle>
                    <CardDescription>Destination ID: {destId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Packages:</span>{" "}
                        <span className="font-medium">{pkgs.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Spend:</span>{" "}
                        <span className="font-medium">
                          {formatISK(pkgs.reduce((s, p) => s + p.spendISK, 0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Net Profit:
                        </span>{" "}
                        <span className="font-medium">
                          {formatISK(
                            pkgs.reduce((s, p) => s + p.netProfitISK, 0)
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium mb-2">Items</div>
                        <ul className="text-sm space-y-1">
                          {aggItems.map((it, i) => (
                            <li
                              key={`${it.typeId}-${i}`}
                              className="flex justify-between gap-4"
                            >
                              <span className="truncate" title={it.name}>
                                {it.name}
                              </span>
                              <span className="tabular-nums">{it.units}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-2">
                          Copyable List
                        </div>
                        <Textarea
                          readOnly
                          value={copyText}
                          className="font-mono text-xs min-h-40"
                        />
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              navigator.clipboard.writeText(copyText)
                            }
                            disabled={!copyText}
                          >
                            Copy list
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
