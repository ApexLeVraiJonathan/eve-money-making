"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { formatIsk } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  Database,
  Clock,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  useSelfMarketDailyAggregates,
  useSelfMarketClearDailyAggregates,
  useSelfMarketCollect,
  useSelfMarketSnapshotLatest,
  useSelfMarketSnapshotLatestTypeSummary,
  useSelfMarketStatus,
  useNpcMarketCollect,
  useNpcMarketDailyAggregates,
  useNpcMarketSnapshotLatest,
  useNpcMarketSnapshotLatestTypeSummary,
  useNpcMarketStatus,
  type NpcMarketOrder,
} from "../../api";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, Math.floor(diffMs / (60 * 1000)));
}

function formatAgeMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

function formatBigIntString(v: string): string {
  try {
    return new Intl.NumberFormat().format(BigInt(v));
  } catch {
    return v;
  }
}

function formatDecimalString(v: string): string {
  // "12345.67" -> "12,345.67"
  const [intPart, frac] = v.split(".");
  const intFmt = formatBigIntString(intPart || "0");
  return frac ? `${intFmt}.${frac}` : intFmt;
}

function formatIso(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace("T", " ").replace("Z", "Z");
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function computeExpiresAt(order: { issued: string; duration: number }): string {
  const issued = new Date(order.issued);
  if (Number.isNaN(issued.getTime())) return "—";
  const ms = issued.getTime() + order.duration * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

// (Grouping logic removed: the overview list now comes from the API type-summary endpoint.)

function TypeOrdersExpanded(props: {
  typeId: number;
  side: "ALL" | "BUY" | "SELL";
  limit: number;
}) {
  const q = useSelfMarketSnapshotLatest({
    limit: props.limit,
    side: props.side,
    typeId: props.typeId,
  });

  const orders = q.data?.orders ?? [];
  const sell = orders
    .filter((o) => !o.is_buy_order)
    .slice()
    .sort((a, b) => a.price - b.price);
  const buy = orders
    .filter((o) => o.is_buy_order)
    .slice()
    .sort((a, b) => b.price - a.price);

  const matched = q.data?.matchedOrders ?? q.data?.filteredOrders ?? null;
  const shown = q.data?.filteredOrders ?? null;

  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading type orders…
        </div>
      ) : q.data ? (
        <>
          <div className="text-xs text-muted-foreground">
            Matched: {matched ?? "—"} · Shown: {shown ?? "—"} (limit{" "}
            {props.limit})
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Sell orders (low → high)
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {sell.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">
                        {formatIso(computeExpiresAt(o))}
                      </td>
                    </tr>
                  ))}
                  {sell.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No sell orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Buy orders (high → low)
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {buy.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">
                        {formatIso(computeExpiresAt(o))}
                      </td>
                    </tr>
                  ))}
                  {buy.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No buy orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No data.</div>
      )}
    </div>
  );
}

function NpcTypeOrdersExpanded(props: {
  stationId: number;
  typeId: number;
  side: "ALL" | "BUY" | "SELL";
  limit: number;
}) {
  const q = useNpcMarketSnapshotLatest({
    stationId: props.stationId,
    limit: props.limit,
    side: props.side,
    typeId: props.typeId,
  });

  const orders = q.data?.orders ?? [];
  const sell = orders
    .filter((o: NpcMarketOrder) => !o.is_buy_order)
    .slice()
    .sort((a, b) => a.price - b.price);
  const buy = orders
    .filter((o: NpcMarketOrder) => o.is_buy_order)
    .slice()
    .sort((a, b) => b.price - a.price);

  const matched = q.data?.matchedOrders ?? q.data?.filteredOrders ?? null;
  const shown = q.data?.filteredOrders ?? null;

  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading type orders…
        </div>
      ) : q.data ? (
        <>
          <div className="text-xs text-muted-foreground">
            Matched: {matched ?? "—"} · Shown: {shown ?? "—"} (limit{" "}
            {props.limit})
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Sell orders (low → high)
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {sell.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">
                        {formatIso(computeExpiresAt(o))}
                      </td>
                    </tr>
                  ))}
                  {sell.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No sell orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Buy orders (high → low)
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {buy.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">
                        {formatIso(computeExpiresAt(o))}
                      </td>
                    </tr>
                  ))}
                  {buy.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No buy orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No data.</div>
      )}
    </div>
  );
}

export default function SelfMarketPage() {
  const qc = useQueryClient();
  const [hub, setHub] = React.useState<"cn" | "rens">("cn");
  const [tab, setTab] = React.useState<"snapshot" | "daily">("snapshot");
  const [forceRefresh, setForceRefresh] = React.useState<boolean>(false);
  const [openTypeIds, setOpenTypeIds] = React.useState<number[]>([]);
  const [copiedTypeId, setCopiedTypeId] = React.useState<number | null>(null);

  // Snapshot controls
  const [snapshotLimit, setSnapshotLimit] = React.useState<number>(200); // type groups
  const [perTypeLimit, setPerTypeLimit] = React.useState<number>(500);
  const [snapshotSide, setSnapshotSide] = React.useState<
    "ALL" | "BUY" | "SELL"
  >("ALL");
  const [snapshotTypeId, setSnapshotTypeId] = React.useState<string>("");

  // Daily controls
  const [dailyDate, setDailyDate] = React.useState<string>(utcToday());
  const [dailyMode, setDailyMode] = React.useState<"LOWER" | "UPPER">("LOWER");
  const [dailySide, setDailySide] = React.useState<"ALL" | "BUY" | "SELL">(
    "SELL",
  );
  const [dailyLimit, setDailyLimit] = React.useState<number>(500);
  const [dailyTypeId, setDailyTypeId] = React.useState<string>("");

  const statusQ = useSelfMarketStatus();
  const hasTypeFilter = Boolean(snapshotTypeId.trim());
  const snapshotQ = useSelfMarketSnapshotLatest(
    {
      // when filtering by typeId we treat snapshotLimit as the per-type order limit
      limit: perTypeLimit,
      side: snapshotSide,
      typeId: snapshotTypeId.trim() ? Number(snapshotTypeId) : undefined,
    },
    { enabled: hasTypeFilter },
  );
  const snapshotTypesQ = useSelfMarketSnapshotLatestTypeSummary(
    {
      limitTypes: snapshotLimit,
      side: snapshotSide,
    },
    { enabled: !hasTypeFilter },
  );
  const dailyQ = useSelfMarketDailyAggregates({
    date: dailyDate,
    hasGone: dailyMode === "UPPER",
    side: dailySide,
    limit: dailyLimit,
    typeId: dailyTypeId.trim() ? Number(dailyTypeId) : undefined,
  });
  const collectM = useSelfMarketCollect();
  const clearDailyM = useSelfMarketClearDailyAggregates();

  // NPC (Rens) section
  const npcStationId = 60004588;
  const [npcForceRefresh, setNpcForceRefresh] = React.useState<boolean>(false);
  const [npcTab, setNpcTab] = React.useState<"snapshot" | "daily">("snapshot");
  const [npcSnapshotLimit, setNpcSnapshotLimit] = React.useState<number>(200);
  const [npcPerTypeLimit, setNpcPerTypeLimit] = React.useState<number>(500);
  const [npcSnapshotSide, setNpcSnapshotSide] = React.useState<
    "ALL" | "BUY" | "SELL"
  >("ALL");
  const [npcOpenTypeIds, setNpcOpenTypeIds] = React.useState<number[]>([]);
  const [npcDailyDate, setNpcDailyDate] = React.useState<string>(utcToday());
  const [npcDailyHasGone, setNpcDailyHasGone] = React.useState<boolean>(false);
  const [npcDailySide, setNpcDailySide] = React.useState<
    "ALL" | "BUY" | "SELL"
  >("SELL");
  const [npcDailyLimit, setNpcDailyLimit] = React.useState<number>(500);
  const [npcDailyTypeId, setNpcDailyTypeId] = React.useState<string>("");

  const npcStatusQ = useNpcMarketStatus({ stationId: npcStationId });
  const npcTypesQ = useNpcMarketSnapshotLatestTypeSummary(
    {
      stationId: npcStationId,
      limitTypes: npcSnapshotLimit,
      side: npcSnapshotSide,
    },
    { enabled: npcTab === "snapshot" },
  );
  const npcCollectM = useNpcMarketCollect();
  const npcDailyQ = useNpcMarketDailyAggregates({
    stationId: npcStationId,
    date: npcDailyDate,
    hasGone: npcDailyHasGone,
    side: npcDailySide,
    limit: npcDailyLimit,
    typeId: npcDailyTypeId.trim() ? Number(npcDailyTypeId) : undefined,
  });

  const status = statusQ.data;
  const enabled = status?.cron.effectiveEnabled ?? false;
  const resolvedStructureId = status?.resolvedStructureId ?? null;
  const snapshotAgeMins = minutesSince(
    status?.latestSnapshot?.observedAt ?? null,
  );
  const snapshotIsStale = snapshotAgeMins !== null && snapshotAgeMins > 30;

  const npcSnapshotAgeMins = minutesSince(
    npcStatusQ.data?.latestSnapshot?.observedAt ?? null,
  );
  const npcSnapshotIsStale =
    npcSnapshotAgeMins !== null && npcSnapshotAgeMins > 30;

  const topError =
    statusQ.error || snapshotQ.error || snapshotTypesQ.error || dailyQ.error
      ? (statusQ.error ?? snapshotQ.error ?? dailyQ.error)
      : null;

  // Ensure mode/filters always trigger a refetch (useful for debugging and avoids
  // "table doesn't change" when React Query serves a cached result).
  React.useEffect(() => {
    if (hub !== "cn" || tab !== "daily") return;
    // Invalidate by prefix so the active query refetches using the latest params,
    // avoiding refetching a stale query instance captured by closure.
    void qc.invalidateQueries({ queryKey: ["selfMarket", "daily"] });
  }, [hub, tab, dailyMode, dailySide, dailyDate, dailyLimit, dailyTypeId, qc]);

  return (
    <div className="space-y-6 p-6">
      <Tabs
        value={hub}
        onValueChange={(v) => setHub(v === "rens" ? "rens" : "cn")}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <h1 className="text-2xl font-semibold">Self Market</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Inspect collected snapshots and computed daily aggregates.
            </p>
            <TabsList>
              <TabsTrigger value="cn">C-N (Structure)</TabsTrigger>
              <TabsTrigger value="rens">Rens (NPC)</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hub === "cn" ? (
              <>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                  />
                  Force refresh
                </label>
                <Button
                  onClick={() =>
                    void collectM.mutateAsync({ forceRefresh }).then(() => {
                      void statusQ.refetch();
                      if (tab === "snapshot") void snapshotQ.refetch();
                      if (tab === "daily") void dailyQ.refetch();
                    })
                  }
                  disabled={collectM.isPending}
                >
                  {collectM.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Collect now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void statusQ.refetch();
                    if (tab === "snapshot") void snapshotQ.refetch();
                    if (tab === "daily") void dailyQ.refetch();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={npcForceRefresh}
                    onChange={(e) => setNpcForceRefresh(e.target.checked)}
                  />
                  Force refresh
                </label>
                <Button
                  onClick={() =>
                    void npcCollectM
                      .mutateAsync({
                        stationId: npcStationId,
                        forceRefresh: npcForceRefresh,
                      })
                      .then(() => {
                        void npcStatusQ.refetch();
                        if (npcTab === "snapshot") void npcTypesQ.refetch();
                        if (npcTab === "daily") void npcDailyQ.refetch();
                      })
                  }
                  disabled={npcCollectM.isPending}
                >
                  {npcCollectM.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Collect now (Rens)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void npcStatusQ.refetch();
                    if (npcTab === "snapshot") void npcTypesQ.refetch();
                    if (npcTab === "daily") void npcDailyQ.refetch();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="cn" className="space-y-6">
          {topError ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {topError instanceof Error
                  ? topError.message
                  : "Request failed"}
              </AlertDescription>
            </Alert>
          ) : null}
          {collectM.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Collect failed:{" "}
                {collectM.error instanceof Error
                  ? collectM.error.message
                  : "Request failed"}
              </AlertDescription>
            </Alert>
          ) : null}
          {clearDailyM.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Clear daily failed:{" "}
                {clearDailyM.error instanceof Error
                  ? clearDailyM.error.message
                  : "Request failed"}
              </AlertDescription>
            </Alert>
          ) : null}
          {enabled && snapshotIsStale ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Latest snapshot is <b>{formatAgeMinutes(snapshotAgeMins)}</b>.
                The collector may be failing or ESI may be down.
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
                <CardDescription>
                  Configured via env vars; admin-only
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {statusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Enabled</span>
                      <span
                        className={
                          enabled ? "text-foreground" : "text-foreground"
                        }
                      >
                        {enabled ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Config flag</span>
                      <span>{status?.config.enabled ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Structure</span>
                      <span className="font-mono">
                        {resolvedStructureId ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Character ID
                      </span>
                      <span className="font-mono">
                        {status?.config.characterId ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Poll</span>
                      <span>{status?.config.pollMinutes ?? 10} min</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Expiry window
                      </span>
                      <span>
                        {status?.config.expiryWindowMinutes ?? 360} min
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-background to-muted/10 shadow-sm">
              <CardHeader>
                <CardTitle>Latest Snapshot</CardTitle>
                <CardDescription>What we last stored from ESI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {statusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : status?.latestSnapshot ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Observed at</span>
                      <span className="font-mono">
                        {formatIso(status.latestSnapshot.observedAt)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Age</span>
                      <span
                        className={
                          snapshotIsStale
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }
                      >
                        {formatAgeMinutes(snapshotAgeMins)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Orders</span>
                      <span>{status.latestSnapshot.orderCount}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Sell / Buy</span>
                      <span>
                        {status.latestSnapshot.sellCount} /{" "}
                        {status.latestSnapshot.buyCount}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Unique types
                      </span>
                      <span>{status.latestSnapshot.uniqueTypes}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    No snapshot stored yet (wait for the collector cron).
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-background to-muted/10 shadow-sm">
              <CardHeader>
                <CardTitle>Aggregates</CardTitle>
                <CardDescription>
                  Daily rows derived from snapshot diffs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {statusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Latest day</span>
                      <span className="font-mono">
                        {status?.latestAggregateDay ?? "—"}
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
            value={tab}
            onValueChange={(v) => setTab(v === "daily" ? "daily" : "snapshot")}
          >
            <TabsList>
              <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
              <TabsTrigger value="daily">Daily Aggregates</TabsTrigger>
            </TabsList>

            <TabsContent value="snapshot" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Snapshot Viewer</CardTitle>
                  <CardDescription>
                    Browse the latest snapshot by item type. “Type limit” limits
                    how many types are listed; expanding a type fetches its
                    orders with the per-type limit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Type limit</Label>
                      <Input
                        value={String(snapshotLimit)}
                        onChange={(e) =>
                          setSnapshotLimit(
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
                        value={snapshotSide}
                        onChange={(e) =>
                          setSnapshotSide(
                            e.target.value as "ALL" | "BUY" | "SELL",
                          )
                        }
                      >
                        <option value="ALL">All</option>
                        <option value="SELL">Sell</option>
                        <option value="BUY">Buy</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Type ID (optional)</Label>
                      <Input
                        value={snapshotTypeId}
                        onChange={(e) => setSnapshotTypeId(e.target.value)}
                        placeholder="e.g. 626"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpenTypeIds([]);
                          if (hasTypeFilter) void snapshotQ.refetch();
                          else void snapshotTypesQ.refetch();
                        }}
                        disabled={
                          (hasTypeFilter && snapshotQ.isFetching) ||
                          (!hasTypeFilter && snapshotTypesQ.isFetching)
                        }
                      >
                        {(
                          hasTypeFilter
                            ? snapshotQ.isFetching
                            : snapshotTypesQ.isFetching
                        ) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Reload snapshot
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Per-type limit (when expanded)</Label>
                      <Input
                        type="number"
                        value={perTypeLimit}
                        min={50}
                        max={50_000}
                        onChange={(e) =>
                          setPerTypeLimit(
                            clampInt(parseInt(e.target.value, 10), 50, 50_000),
                          )
                        }
                      />
                      <div className="text-xs text-muted-foreground">
                        Expanding a type fetches its orders by typeId.
                      </div>
                    </div>
                  </div>

                  {hasTypeFilter ? (
                    snapshotQ.isLoading ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading
                        type…
                      </div>
                    ) : snapshotQ.data ? (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Observed:
                          </span>{" "}
                          <span className="font-mono">
                            {formatIso(snapshotQ.data.observedAt)}
                          </span>{" "}
                          ·{" "}
                          <span className="text-muted-foreground">
                            Total orders:
                          </span>{" "}
                          {snapshotQ.data.totalOrders} ·{" "}
                          <span className="text-muted-foreground">
                            Matched:
                          </span>{" "}
                          {snapshotQ.data.matchedOrders ??
                            snapshotQ.data.filteredOrders}{" "}
                          ·{" "}
                          <span className="text-muted-foreground">Shown:</span>{" "}
                          {snapshotQ.data.filteredOrders} (limit {perTypeLimit})
                        </div>

                        {snapshotQ.data.orders.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            No rows match the current filters.
                          </div>
                        ) : (
                          <TypeOrdersExpanded
                            typeId={Number(snapshotTypeId)}
                            side={snapshotSide}
                            limit={perTypeLimit}
                          />
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No data.
                      </div>
                    )
                  ) : snapshotTypesQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      types…
                    </div>
                  ) : snapshotTypesQ.data ? (
                    <>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Observed:</span>{" "}
                        <span className="font-mono">
                          {formatIso(snapshotTypesQ.data.observedAt)}
                        </span>{" "}
                        ·{" "}
                        <span className="text-muted-foreground">
                          Total orders:
                        </span>{" "}
                        {snapshotTypesQ.data.totalOrders} ·{" "}
                        <span className="text-muted-foreground">
                          Matched orders:
                        </span>{" "}
                        {snapshotTypesQ.data.matchedOrders} ·{" "}
                        <span className="text-muted-foreground">
                          Unique types:
                        </span>{" "}
                        {snapshotTypesQ.data.uniqueTypes} ·{" "}
                        <span className="text-muted-foreground">
                          Shown types:
                        </span>{" "}
                        {snapshotTypesQ.data.types.length} (limit{" "}
                        {snapshotLimit})
                      </div>

                      {snapshotTypesQ.data.types.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No rows match the current filters.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setOpenTypeIds(
                                  snapshotTypesQ.data.types.map(
                                    (t) => t.typeId,
                                  ),
                                )
                              }
                            >
                              Expand all types
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setOpenTypeIds([])}
                            >
                              Collapse all
                            </Button>
                          </div>

                          {snapshotTypesQ.data.types.map((t) => {
                            const key = t.typeId;
                            const isOpen = openTypeIds.includes(key);
                            const total = t.sellCount + t.buyCount;
                            const typeName = t.typeName ?? null;
                            const bestSell = t.bestSell ?? null;
                            const bestBuy = t.bestBuy ?? null;

                            const onCopyType = async () => {
                              try {
                                const txt = typeName ?? String(t.typeId);
                                await navigator.clipboard.writeText(txt);
                                setCopiedTypeId(t.typeId);
                              } catch (err) {
                                console.error("Failed to copy type name:", err);
                              }
                            };

                            return (
                              <div key={key} className="rounded-md border">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-2 text-left"
                                  onClick={() =>
                                    setOpenTypeIds((prev) =>
                                      prev.includes(key)
                                        ? prev.filter((x) => x !== key)
                                        : [...prev, key],
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setOpenTypeIds((prev) =>
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
                                        (
                                        <span className="font-mono">
                                          {t.typeId}
                                        </span>
                                        )
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          // Stop the parent row click from toggling.
                                          e.stopPropagation();
                                          void onCopyType();
                                        }}
                                        title="Copy item name"
                                      >
                                        {copiedTypeId === t.typeId ? (
                                          <Check className="h-4 w-4" />
                                        ) : (
                                          <Copy className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {total} order(s) · Sell {t.sellCount} ·
                                      Buy {t.buyCount}
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
                                    <TypeOrdersExpanded
                                      typeId={t.typeId}
                                      side={snapshotSide}
                                      limit={perTypeLimit}
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
                    <div className="text-sm text-muted-foreground">
                      No data.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="daily" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Aggregates</CardTitle>
                  <CardDescription>
                    These rows are derived incrementally as snapshots are
                    collected.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="space-y-1">
                      <Label>Date (UTC)</Label>
                      <Input
                        type="date"
                        value={dailyDate}
                        onChange={(e) => setDailyDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mode</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={dailyMode}
                        onChange={(e) =>
                          setDailyMode(
                            e.target.value === "UPPER" ? "UPPER" : "LOWER",
                          )
                        }
                      >
                        <option value="LOWER">Lower (deltas only)</option>
                        <option value="UPPER">Upper (+ gone)</option>
                      </select>
                      <div className="text-xs text-muted-foreground">
                        Sending hasGone:{" "}
                        {dailyMode === "UPPER" ? "true" : "false"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Side</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={dailySide}
                        onChange={(e) =>
                          setDailySide(e.target.value as "ALL" | "BUY" | "SELL")
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
                        value={dailyTypeId}
                        onChange={(e) => setDailyTypeId(e.target.value)}
                        placeholder="e.g. 626"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Limit</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5000}
                        value={String(dailyLimit)}
                        onChange={(e) =>
                          setDailyLimit(Number(e.target.value || 500))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void dailyQ.refetch()}
                      disabled={dailyQ.isFetching}
                    >
                      {dailyQ.isFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reload aggregates
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        void clearDailyM
                          .mutateAsync({ date: dailyDate })
                          .then(() => {
                            void dailyQ.refetch();
                            void statusQ.refetch();
                          })
                      }
                      disabled={clearDailyM.isPending}
                      title="Non-prod only. Clears all self-market rows for the selected UTC date."
                    >
                      {clearDailyM.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Clear this day (dev)
                    </Button>
                  </div>

                  {dailyQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      aggregates…
                    </div>
                  ) : dailyQ.data ? (
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
                          {dailyQ.data.rows.map((r) => (
                            <tr
                              key={`${r.typeId}:${r.isBuyOrder}:${r.hasGone}`}
                              className="border-t"
                            >
                              <td className="p-2">
                                <span className="font-medium">
                                  {dailyQ.data.typeNames?.[String(r.typeId)] ??
                                    String(r.typeId)}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  (<span className="font-mono">{r.typeId}</span>
                                  )
                                </span>
                              </td>
                              <td className="p-2">
                                {r.isBuyOrder ? "BUY" : "SELL"}
                              </td>
                              <td className="p-2">
                                {r.hasGone ? "UPPER" : "LOWER"}
                              </td>
                              <td className="p-2 font-mono">
                                {formatBigIntString(r.amount)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.iskValue)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.avg)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.low)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.high)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatBigIntString(r.orderNum)}
                              </td>
                            </tr>
                          ))}
                          {dailyQ.data.rows.length === 0 ? (
                            <tr className="border-t">
                              <td
                                className="p-3 text-muted-foreground"
                                colSpan={9}
                              >
                                No rows yet for this date/filters (wait for
                                snapshots).
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No data.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="rens" className="space-y-6">
          {npcStatusQ.error ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {npcStatusQ.error instanceof Error
                  ? npcStatusQ.error.message
                  : "NPC status request failed"}
              </AlertDescription>
            </Alert>
          ) : null}
          {npcCollectM.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                NPC collect failed:{" "}
                {npcCollectM.error instanceof Error
                  ? npcCollectM.error.message
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
                {npcStatusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : npcStatusQ.data ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Enabled</span>
                      <span>
                        {npcStatusQ.data.cron.effectiveEnabled ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Config flag</span>
                      <span>
                        {npcStatusQ.data.config.enabled ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Station</span>
                      <span className="font-mono">
                        {npcStatusQ.data.resolvedStation?.stationId ??
                          npcStationId}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Name</span>
                      <span>
                        {npcStatusQ.data.resolvedStation?.stationName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Poll</span>
                      <span>{npcStatusQ.data.config.pollMinutes} min</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Expiry window
                      </span>
                      <span>
                        {npcStatusQ.data.config.expiryWindowMinutes} min
                      </span>
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
                {npcStatusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : npcStatusQ.data?.latestSnapshot ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Observed at</span>
                      <span className="font-mono">
                        {formatIso(npcStatusQ.data.latestSnapshot.observedAt)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Age</span>
                      <span
                        className={
                          npcSnapshotIsStale
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }
                      >
                        {formatAgeMinutes(npcSnapshotAgeMins)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Orders</span>
                      <span>{npcStatusQ.data.latestSnapshot.orderCount}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Sell / Buy</span>
                      <span>
                        {npcStatusQ.data.latestSnapshot.sellCount} /{" "}
                        {npcStatusQ.data.latestSnapshot.buyCount}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Unique types
                      </span>
                      <span>{npcStatusQ.data.latestSnapshot.uniqueTypes}</span>
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
                <CardDescription>
                  Daily rows derived from snapshot diffs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {npcStatusQ.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Latest day</span>
                      <span className="font-mono">
                        {npcStatusQ.data?.latestAggregateDay ?? "—"}
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
            value={npcTab}
            onValueChange={(v) =>
              setNpcTab(v === "daily" ? "daily" : "snapshot")
            }
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
                    Browse the latest station-filtered snapshot by item type
                    (from stored snapshot stats).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Type limit</Label>
                      <Input
                        value={String(npcSnapshotLimit)}
                        onChange={(e) =>
                          setNpcSnapshotLimit(
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
                        value={npcSnapshotSide}
                        onChange={(e) =>
                          setNpcSnapshotSide(
                            e.target.value as "ALL" | "BUY" | "SELL",
                          )
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
                        value={npcPerTypeLimit}
                        min={50}
                        max={50_000}
                        onChange={(e) =>
                          setNpcPerTypeLimit(
                            clampInt(parseInt(e.target.value, 10), 50, 50_000),
                          )
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setNpcOpenTypeIds([]);
                          void npcTypesQ.refetch();
                        }}
                        disabled={npcTypesQ.isFetching}
                      >
                        {npcTypesQ.isFetching ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Reload snapshot
                      </Button>
                    </div>
                  </div>

                  {npcTypesQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      types…
                    </div>
                  ) : npcTypesQ.data ? (
                    <>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Observed:</span>{" "}
                        <span className="font-mono">
                          {formatIso(npcTypesQ.data.observedAt ?? null)}
                        </span>{" "}
                        ·{" "}
                        <span className="text-muted-foreground">
                          Shown types:
                        </span>{" "}
                        {npcTypesQ.data.types.length} (limit {npcSnapshotLimit})
                      </div>

                      {npcTypesQ.data.types.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No types yet (run a collection; first run sets
                          baseline).
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setNpcOpenTypeIds(
                                  npcTypesQ.data!.types.map((t) => t.typeId),
                                )
                              }
                            >
                              Expand all types
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setNpcOpenTypeIds([])}
                            >
                              Collapse all
                            </Button>
                          </div>

                          {npcTypesQ.data.types.map((t) => {
                            const key = t.typeId;
                            const isOpen = npcOpenTypeIds.includes(key);
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
                                    setNpcOpenTypeIds((prev) =>
                                      prev.includes(key)
                                        ? prev.filter((x) => x !== key)
                                        : [...prev, key],
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setNpcOpenTypeIds((prev) =>
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
                                        (
                                        <span className="font-mono">
                                          {t.typeId}
                                        </span>
                                        )
                                      </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {total} order(s) · Sell {t.sellCount} ·
                                      Buy {t.buyCount}
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
                                      stationId={npcStationId}
                                      typeId={t.typeId}
                                      side={npcSnapshotSide}
                                      limit={npcPerTypeLimit}
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
                    <div className="text-sm text-muted-foreground">
                      No data.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="daily" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Aggregates (Rens)</CardTitle>
                  <CardDescription>
                    These rows are derived incrementally as snapshots are
                    collected.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="space-y-1">
                      <Label>Date (UTC)</Label>
                      <Input
                        type="date"
                        value={npcDailyDate}
                        onChange={(e) => setNpcDailyDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mode</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={npcDailyHasGone ? "UPPER" : "LOWER"}
                        onChange={(e) =>
                          setNpcDailyHasGone(e.target.value === "UPPER")
                        }
                      >
                        <option value="LOWER">Lower (deltas only)</option>
                        <option value="UPPER">Upper (+ gone)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Side</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={npcDailySide}
                        onChange={(e) =>
                          setNpcDailySide(
                            e.target.value as "ALL" | "BUY" | "SELL",
                          )
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
                        value={npcDailyTypeId}
                        onChange={(e) => setNpcDailyTypeId(e.target.value)}
                        placeholder="e.g. 626"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Limit</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5000}
                        value={String(npcDailyLimit)}
                        onChange={(e) =>
                          setNpcDailyLimit(Number(e.target.value || 500))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void npcDailyQ.refetch()}
                      disabled={npcDailyQ.isFetching}
                    >
                      {npcDailyQ.isFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reload aggregates
                    </Button>
                  </div>

                  {npcDailyQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      aggregates…
                    </div>
                  ) : npcDailyQ.data ? (
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
                          {npcDailyQ.data.rows.map((r) => (
                            <tr
                              key={`${r.typeId}:${r.isBuyOrder}:${r.hasGone}`}
                              className="border-t"
                            >
                              <td className="p-2">
                                <span className="font-medium">
                                  {npcDailyQ.data.typeNames?.[
                                    String(r.typeId)
                                  ] ?? String(r.typeId)}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  (<span className="font-mono">{r.typeId}</span>
                                  )
                                </span>
                              </td>
                              <td className="p-2">
                                {r.isBuyOrder ? "BUY" : "SELL"}
                              </td>
                              <td className="p-2">
                                {r.hasGone ? "UPPER" : "LOWER"}
                              </td>
                              <td className="p-2 font-mono">
                                {formatBigIntString(r.amount)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.iskValue)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.avg)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.low)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatDecimalString(r.high)}
                              </td>
                              <td className="p-2 font-mono">
                                {formatBigIntString(r.orderNum)}
                              </td>
                            </tr>
                          ))}
                          {npcDailyQ.data.rows.length === 0 ? (
                            <tr className="border-t">
                              <td
                                className="p-3 text-muted-foreground"
                                colSpan={9}
                              >
                                No rows yet for this date/filters (run
                                collection at least twice).
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No data.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
