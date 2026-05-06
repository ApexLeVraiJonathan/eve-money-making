"use client";

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import { AlertCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import type {
  NpcMarketDailyAggregatesResponse,
  NpcMarketSnapshotTypeSummaryResponse,
  NpcMarketStatusResponse,
} from "@eve/shared/tradecraft-market";
import { formatIsk } from "@/lib/utils";
import {
  clampInt,
  formatAgeMinutes,
  formatBigIntString,
  formatDecimalString,
  formatIso,
} from "../lib/market-utils";
import { NpcTypeOrdersExpanded } from "./npc-type-orders-expanded";

type QueryState<T> = {
  isLoading: boolean;
  isFetching: boolean;
  data: T | undefined;
  error: unknown;
  refetch: () => Promise<unknown>;
};

type MutationState = {
  isPending: boolean;
  error: unknown;
};

type RensMarketTabProps = {
  stationId: number;
  npcSnapshotIsStale: boolean;
  npcSnapshotAgeMins: number | null;
  npcStatusQ: QueryState<NpcMarketStatusResponse>;
  npcCollectM: MutationState;
  npcTab: "snapshot" | "daily";
  setNpcTab: (tab: "snapshot" | "daily") => void;
  npcSnapshotLimit: number;
  setNpcSnapshotLimit: React.Dispatch<React.SetStateAction<number>>;
  npcPerTypeLimit: number;
  setNpcPerTypeLimit: React.Dispatch<React.SetStateAction<number>>;
  npcSnapshotSide: "ALL" | "BUY" | "SELL";
  setNpcSnapshotSide: React.Dispatch<React.SetStateAction<"ALL" | "BUY" | "SELL">>;
  npcOpenTypeIds: number[];
  setNpcOpenTypeIds: React.Dispatch<React.SetStateAction<number[]>>;
  npcTypesQ: QueryState<NpcMarketSnapshotTypeSummaryResponse>;
  npcDailyDate: string;
  setNpcDailyDate: React.Dispatch<React.SetStateAction<string>>;
  npcDailyHasGone: boolean;
  setNpcDailyHasGone: React.Dispatch<React.SetStateAction<boolean>>;
  npcDailySide: "ALL" | "BUY" | "SELL";
  setNpcDailySide: React.Dispatch<React.SetStateAction<"ALL" | "BUY" | "SELL">>;
  npcDailyLimit: number;
  setNpcDailyLimit: React.Dispatch<React.SetStateAction<number>>;
  npcDailyTypeId: string;
  setNpcDailyTypeId: React.Dispatch<React.SetStateAction<string>>;
  npcDailyQ: QueryState<NpcMarketDailyAggregatesResponse>;
  onReloadNpcSnapshot: () => void;
  onReloadNpcDaily: () => void;
};

export function RensMarketTabSection(props: RensMarketTabProps) {
  return (
    <TabsContent value="rens" className="space-y-6">
      {props.npcStatusQ.error ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {props.npcStatusQ.error instanceof Error
              ? props.npcStatusQ.error.message
              : "NPC status request failed"}
          </AlertDescription>
        </Alert>
      ) : null}
      {props.npcCollectM.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            NPC collect failed:{" "}
            {props.npcCollectM.error instanceof Error
              ? props.npcCollectM.error.message
              : "Request failed"}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="bg-gradient-to-b from-background to-muted/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Collector Status
            </CardTitle>
            <CardDescription>Admin-only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {props.npcStatusQ.isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : props.npcStatusQ.data ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Enabled</span>
                  <span>
                    {props.npcStatusQ.data.cron.effectiveEnabled ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Station</span>
                  <span className="font-mono">
                    {props.npcStatusQ.data.resolvedStation?.stationId ?? props.stationId}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Name</span>
                  <span>{props.npcStatusQ.data.resolvedStation?.stationName ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Poll</span>
                  <span>{props.npcStatusQ.data.config.pollMinutes} min</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Expiry window</span>
                  <span>{props.npcStatusQ.data.config.expiryWindowMinutes} min</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">No data.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/10 shadow-sm">
          <CardHeader>
            <CardTitle>Latest Snapshot</CardTitle>
            <CardDescription>What we last stored from ESI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {props.npcStatusQ.isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : props.npcStatusQ.data?.latestSnapshot ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Observed at</span>
                  <span className="font-mono">
                    {formatIso(props.npcStatusQ.data.latestSnapshot.observedAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Age</span>
                  <span
                    className={
                      props.npcSnapshotIsStale ? "text-red-600 dark:text-red-400" : ""
                    }
                  >
                    {formatAgeMinutes(props.npcSnapshotAgeMins)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Orders</span>
                  <span>{props.npcStatusQ.data.latestSnapshot.orderCount}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Sell / Buy</span>
                  <span>
                    {props.npcStatusQ.data.latestSnapshot.sellCount} /{" "}
                    {props.npcStatusQ.data.latestSnapshot.buyCount}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Unique types</span>
                  <span>{props.npcStatusQ.data.latestSnapshot.uniqueTypes}</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                No snapshot stored yet (run collection).
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/10 shadow-sm">
          <CardHeader>
            <CardTitle>Aggregates</CardTitle>
            <CardDescription>Daily rows derived from snapshot diffs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {props.npcStatusQ.isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Latest day</span>
                  <span className="font-mono">
                    {props.npcStatusQ.data?.latestAggregateDay ?? "—"}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Use the tab below to inspect rows.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={props.npcTab}
        onValueChange={(v) => props.setNpcTab(v === "daily" ? "daily" : "snapshot")}
      >
        <TabsList>
          <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
          <TabsTrigger value="daily">Daily Aggregates</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot Viewer (Rens)</CardTitle>
              <CardDescription>
                Browse the latest station-filtered snapshot by item type (from
                stored snapshot stats).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Type limit</Label>
                  <Input
                    value={String(props.npcSnapshotLimit)}
                    onChange={(e) =>
                      props.setNpcSnapshotLimit(
                        clampInt(parseInt(e.target.value, 10), 1, 5000),
                      )
                    }
                    type="number"
                    min={1}
                    max={5000}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Side</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={props.npcSnapshotSide}
                    onChange={(e) =>
                      props.setNpcSnapshotSide(e.target.value as "ALL" | "BUY" | "SELL")
                    }
                  >
                    <option value="ALL">All</option>
                    <option value="SELL">Sell</option>
                    <option value="BUY">Buy</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Per-type limit (when expanded)</Label>
                  <Input
                    type="number"
                    value={props.npcPerTypeLimit}
                    min={50}
                    max={50_000}
                    onChange={(e) =>
                      props.setNpcPerTypeLimit(
                        clampInt(parseInt(e.target.value, 10), 50, 50_000),
                      )
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={props.onReloadNpcSnapshot}
                    disabled={props.npcTypesQ.isFetching}
                  >
                    {props.npcTypesQ.isFetching ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Reload snapshot
                  </Button>
                </div>
              </div>

              {props.npcTypesQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading types…
                </div>
              ) : props.npcTypesQ.data ? (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Observed:</span>{" "}
                    <span className="font-mono">
                      {formatIso(props.npcTypesQ.data.observedAt ?? null)}
                    </span>{" "}
                    · <span className="text-muted-foreground">Shown types:</span>{" "}
                    {props.npcTypesQ.data.types.length} (limit {props.npcSnapshotLimit})
                  </div>

                  {props.npcTypesQ.data.types.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No types yet (run a collection; first run sets baseline).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            props.setNpcOpenTypeIds(
                              props.npcTypesQ.data!.types.map((t) => t.typeId),
                            )
                          }
                        >
                          Expand all types
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => props.setNpcOpenTypeIds([])}
                        >
                          Collapse all
                        </Button>
                      </div>

                      {props.npcTypesQ.data.types.map((t) => {
                        const key = t.typeId;
                        const isOpen = props.npcOpenTypeIds.includes(key);
                        const total = t.sellCount + t.buyCount;
                        const typeName = t.typeName ?? null;
                        const bestSell = t.bestSell ?? null;
                        const bestBuy = t.bestBuy ?? null;

                        return (
                          <div key={key} className="rounded-md border">
                            <div
                              role="button"
                              tabIndex={0}
                              className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2 text-left"
                              onClick={() =>
                                props.setNpcOpenTypeIds((prev) =>
                                  prev.includes(key)
                                    ? prev.filter((x) => x !== key)
                                    : [...prev, key],
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  props.setNpcOpenTypeIds((prev) =>
                                    prev.includes(key)
                                      ? prev.filter((x) => x !== key)
                                      : [...prev, key],
                                  );
                                }
                              }}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 font-medium">
                                  <span>{typeName ?? "Type"}</span>
                                  <span className="text-muted-foreground">
                                    (<span className="font-mono">{t.typeId}</span>)
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {total} order(s) · Sell {t.sellCount} · Buy {t.buyCount}
                                  {bestSell !== null
                                    ? ` · Best sell ${formatIsk(bestSell)}`
                                    : ""}
                                  {bestBuy !== null
                                    ? ` · Best buy ${formatIsk(bestBuy)}`
                                    : ""}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isOpen ? "Hide" : "Show"}
                              </div>
                            </div>

                            {isOpen ? (
                              <div className="space-y-4 p-3">
                                <NpcTypeOrdersExpanded
                                  stationId={props.stationId}
                                  typeId={t.typeId}
                                  side={props.npcSnapshotSide}
                                  limit={props.npcPerTypeLimit}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No data.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Aggregates (Rens)</CardTitle>
              <CardDescription>
                These rows are derived incrementally as snapshots are collected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <Label>Date (UTC)</Label>
                  <Input
                    type="date"
                    value={props.npcDailyDate}
                    onChange={(e) => props.setNpcDailyDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mode</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={props.npcDailyHasGone ? "UPPER" : "LOWER"}
                    onChange={(e) => props.setNpcDailyHasGone(e.target.value === "UPPER")}
                  >
                    <option value="LOWER">Lower (deltas only)</option>
                    <option value="UPPER">Upper (+ gone)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Side</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={props.npcDailySide}
                    onChange={(e) =>
                      props.setNpcDailySide(e.target.value as "ALL" | "BUY" | "SELL")
                    }
                  >
                    <option value="SELL">Sell</option>
                    <option value="BUY">Buy</option>
                    <option value="ALL">All</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Type ID (optional)</Label>
                  <Input
                    value={props.npcDailyTypeId}
                    onChange={(e) => props.setNpcDailyTypeId(e.target.value)}
                    placeholder="e.g. 626"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={String(props.npcDailyLimit)}
                    onChange={(e) => props.setNpcDailyLimit(Number(e.target.value || 500))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={props.onReloadNpcDaily}
                  disabled={props.npcDailyQ.isFetching}
                >
                  {props.npcDailyQ.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reload aggregates
                </Button>
              </div>

              {props.npcDailyQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading aggregates…
                </div>
              ) : props.npcDailyQ.data ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-2">Type</th>
                        <th className="p-2">Side</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">ISK</th>
                        <th className="p-2">Avg</th>
                        <th className="p-2">Low</th>
                        <th className="p-2">High</th>
                        <th className="p-2">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.npcDailyQ.data.rows.map((r) => (
                        <tr
                          key={`${r.typeId}:${r.isBuyOrder}:${r.hasGone}`}
                          className="border-t"
                        >
                          <td className="p-2">
                            <span className="font-medium">
                              {props.npcDailyQ.data?.typeNames?.[String(r.typeId)] ??
                                String(r.typeId)}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              (<span className="font-mono">{r.typeId}</span>)
                            </span>
                          </td>
                          <td className="p-2">{r.isBuyOrder ? "BUY" : "SELL"}</td>
                          <td className="p-2">{r.hasGone ? "UPPER" : "LOWER"}</td>
                          <td className="p-2 font-mono">
                            {formatBigIntString(r.amount)}
                          </td>
                          <td className="p-2 font-mono">
                            {formatDecimalString(r.iskValue)}
                          </td>
                          <td className="p-2 font-mono">{formatDecimalString(r.avg)}</td>
                          <td className="p-2 font-mono">{formatDecimalString(r.low)}</td>
                          <td className="p-2 font-mono">{formatDecimalString(r.high)}</td>
                          <td className="p-2 font-mono">
                            {formatBigIntString(r.orderNum)}
                          </td>
                        </tr>
                      ))}
                      {props.npcDailyQ.data.rows.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-3 text-muted-foreground" colSpan={9}>
                            No rows yet for this date/filters (run collection at least
                            twice).
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabsContent>
  );
}
