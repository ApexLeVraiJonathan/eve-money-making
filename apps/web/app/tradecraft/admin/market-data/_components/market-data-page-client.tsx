"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Database, RefreshCw } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import {
  useNpcMarketAdam4EveComparison,
  useCleanupRawNpcMarketData,
  useMarketDataAnomalies,
  useMarketDataHealth,
  useMarketDataReadiness,
  useMarketDataSpaceReport,
} from "@/app/tradecraft/api/market";
import type {
  MarketDataSpaceReportResponse,
  MarketSide,
} from "@eve/shared/tradecraft-market";

type MarketSpaceTable = MarketDataSpaceReportResponse["tables"][number];
const NPC_RENS_STATION_ID = 60004588;

export default function MarketDataPageClient() {
  const defaultRange = getDefaultComparisonRange();
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string>(String(NPC_RENS_STATION_ID));
  const [startDate, setStartDate] = useState<string>(defaultRange.startDate);
  const [endDate, setEndDate] = useState<string>(defaultRange.endDate);
  const [side, setSide] = useState<MarketSide>("SELL");
  const [limit, setLimit] = useState<number>(25);
  const spaceReport = useMarketDataSpaceReport();
  const cleanupRawNpc = useCleanupRawNpcMarketData();
  const comparison = useNpcMarketAdam4EveComparison({
    stationId: stationId.trim() ? Number(stationId) : undefined,
    startDate,
    endDate,
    side,
    limit,
  });
  const health = useMarketDataHealth({ startDate, endDate });
  const anomalies = useMarketDataAnomalies();
  const readiness = useMarketDataReadiness();
  const report = spaceReport.data;

  const onCleanupRawNpc = async () => {
    setCleanupMessage(null);
    try {
      const result = await cleanupRawNpc.mutateAsync();
      if (result.skipped) {
        setCleanupMessage(result.reason ?? "Cleanup was skipped.");
        return;
      }
      setCleanupMessage(
        `Deleted ${result.deleted.npcMarketSnapshots} snapshot rows, ${result.deleted.npcMarketRegionTypesSnapshots} region-type rows, and ${result.deleted.npcMarketRuns} run rows older than ${formatDate(result.cutoff)}.`,
      );
    } catch {
      // The mutation exposes the actual error through cleanupRawNpc.error.
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Database className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Market Data Reliability
            </h1>
            <p className="text-sm text-muted-foreground">
              Admin-only visibility into market table storage and retention risk.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void spaceReport.refetch()}
            disabled={spaceReport.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${spaceReport.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={() => void onCleanupRawNpc()}
            disabled={cleanupRawNpc.isPending}
            title="Deletes expired raw NPC snapshots and run metadata while preserving active baselines."
          >
            {cleanupRawNpc.isPending ? "Cleaning..." : "Run Raw NPC Cleanup"}
          </Button>
        </div>
      </div>

      {spaceReport.error || cleanupRawNpc.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {cleanupRawNpc.error instanceof Error
              ? cleanupRawNpc.error.message
              : spaceReport.error instanceof Error
              ? spaceReport.error.message
              : "Failed to load market data space report."}
          </AlertDescription>
        </Alert>
      ) : null}

      {cleanupMessage ? (
        <Alert>
          <AlertDescription>{cleanupMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Global Migration Readiness</CardTitle>
              <CardDescription>
                One cautious status for replacing Adam4EVE-backed market data.
                Adam4EVE remains a reference signal only.
              </CardDescription>
            </div>
            <Badge variant={readinessBadgeVariant(readiness.data?.status)}>
              {readiness.data?.label ?? "Loading"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {readiness.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {readiness.error instanceof Error
                  ? readiness.error.message
                  : "Failed to load market readiness."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              title="New Signal Gate"
              value={
                readiness.data
                  ? `${readiness.data.validationWindow.elapsedDays}/${readiness.data.validationWindow.requiredDays}`
                  : "-"
              }
              description={
                readiness.data
                  ? `Eligible ${formatDate(readiness.data.validationWindow.eligibleOn)}`
                  : "Validation window"
              }
            />
            <SummaryCard
              title="Scan Health"
              value={
                readiness.data
                  ? `${readiness.data.checks.scanHealth.npcStatus} / ${readiness.data.checks.scanHealth.selfStatus}`
                  : "-"
              }
              description="NPC and self-market"
            />
            <SummaryCard
              title="NPC Reference"
              value={
                readiness.data
                  ? `${Math.round(
                      (1 -
                        readiness.data.checks.adam4eveReference
                          .missingNpcRatio) *
                        100,
                    )}%`
                  : "-"
              }
              description="Local keys present vs Adam4EVE"
            />
            <SummaryCard
              title="Anomalies"
              value={
                readiness.data
                  ? `${readiness.data.checks.anomalies.severe} severe`
                  : "-"
              }
              description={`${readiness.data?.checks.anomalies.borderline ?? 0} borderline`}
            />
          </div>

          <div className="rounded-md border p-3 text-sm">
            {(readiness.data?.reasons ?? []).map((reason) => (
              <div key={reason}>{reason}</div>
            ))}
            {!readiness.data && !readiness.isLoading ? (
              <div className="text-muted-foreground">
                No readiness report available.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Total Size"
          value={formatBytes(report?.totals.totalBytes)}
          description="Table + indexes"
        />
        <SummaryCard
          title="Table Data"
          value={formatBytes(report?.totals.tableBytes)}
          description="Heap/toast storage"
        />
        <SummaryCard
          title="Indexes"
          value={formatBytes(report?.totals.indexBytes)}
          description="Index storage"
        />
        <SummaryCard
          title="Tables"
          value={
            report
              ? `${report.totals.existingTableCount}/${report.tables.length}`
              : "..."
          }
          description="Existing tracked tables"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Market Table Space</CardTitle>
          <CardDescription>
            Row counts are PostgreSQL live-row estimates to avoid expensive full
            counts against large snapshot tables.
            {report?.generatedAt
              ? ` Last generated ${formatDateTime(report.generatedAt)}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Table</TableHead>
                <TableHead className="text-right">Indexes</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.tables ?? []).map((table) => (
                <TableRow key={table.tableName}>
                  <TableCell>
                    <div className="font-medium">{table.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {table.tableName}
                    </div>
                    {!table.exists ? (
                      <Badge variant="outline" className="mt-2">
                        missing
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={policyBadgeVariant(table.retentionPolicy)}>
                        {formatPolicy(table.retentionPolicy)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {formatCategory(table.category)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRows(table)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(table.tableBytes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(table.indexBytes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatBytes(table.totalBytes)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>{formatDate(table.oldestRecordAt)}</div>
                      <div className="text-muted-foreground">
                        to {formatDate(table.newestRecordAt)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {table.notes ?? "No notes."}
                  </TableCell>
                </TableRow>
              ))}
              {!report?.tables.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {spaceReport.isLoading
                      ? "Loading market data space report..."
                      : "No market data space report available."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NPC vs Adam4EVE Reference Check</CardTitle>
          <CardDescription>
            Adam4EVE is shown as a temporary reference signal for NPC markets,
            not as ground truth. Self-market structures are not compared here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <LabeledField label="Station ID">
              <Input
                value={stationId}
                onChange={(event) => setStationId(event.target.value)}
              />
            </LabeledField>
            <LabeledField label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </LabeledField>
            <LabeledField label="End date">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </LabeledField>
            <LabeledField label="Side">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={side}
                onChange={(event) => setSide(event.target.value as MarketSide)}
              >
                <option value="SELL">SELL</option>
                <option value="BUY">BUY</option>
                <option value="ALL">ALL</option>
              </select>
            </LabeledField>
            <LabeledField label="Top mismatches">
              <Input
                type="number"
                min={1}
                max={2000}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value) || 25)}
              />
            </LabeledField>
          </div>

          {comparison.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {comparison.error instanceof Error
                  ? comparison.error.message
                  : "Failed to load NPC comparison."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              title="Coverage"
              value={formatCoverage(comparison.data?.summary)}
              description="Rows present in our NPC data"
            />
            <SummaryCard
              title="NPC Rows"
              value={formatCount(comparison.data?.summary.npcRows)}
              description="Gathered aggregate rows"
            />
            <SummaryCard
              title="Adam4EVE Rows"
              value={formatCount(comparison.data?.summary.adamRows)}
              description="Reference aggregate rows"
            />
            <SummaryCard
              title="Missing NPC"
              value={formatCount(comparison.data?.summary.missingNpc)}
              description="Reference keys absent locally"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">NPC ISK</TableHead>
                <TableHead className="text-right">Adam4EVE ISK</TableHead>
                <TableHead className="text-right">ISK Diff</TableHead>
                <TableHead className="text-right">Amount Diff</TableHead>
                <TableHead className="text-right">Orders Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(comparison.data?.diffs ?? []).map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.scanDate}</TableCell>
                  <TableCell>{row.typeId}</TableCell>
                  <TableCell>
                    {row.isBuyOrder ? "BUY" : "SELL"} /{" "}
                    {row.hasGone ? "has gone" : "delta"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(row.npc?.iskValue ?? null)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(row.adam4eve?.iskValue ?? null)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatIsk(row.diff.iskValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSignedNumber(row.diff.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSignedNumber(row.diff.orderNum)}
                  </TableCell>
                </TableRow>
              ))}
              {!comparison.data?.diffs.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {comparison.isLoading
                      ? "Loading NPC comparison..."
                      : "No comparison rows for this filter."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal Scan Health</CardTitle>
          <CardDescription>
            Completeness and stability checks from our own gathered NPC and
            self-market data. These checks do not use Adam4EVE as authority.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {health.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {health.error instanceof Error
                  ? health.error.message
                  : "Failed to load market scan health."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {(health.data?.sources ?? []).map((source) => (
              <Card key={source.source}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{source.label}</CardTitle>
                    <Badge variant={healthBadgeVariant(source.status)}>
                      {source.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {source.daysWithData}/{source.expectedDays} days with
                    aggregate data
                    {source.successfulRuns !== null
                      ? `, ${source.successfulRuns} successful runs`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Latest observed</div>
                      <div>{formatDate(source.latestObservedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Missing days</div>
                      <div>{source.missingDays.length}</div>
                    </div>
                  </div>
                  {source.warnings.length ? (
                    <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                      {source.warnings.slice(0, 3).map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                      {source.warnings.length > 3 ? (
                        <div className="text-muted-foreground">
                          +{source.warnings.length - 3} more warnings
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No scan-health warnings for this range.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {!health.data?.sources.length ? (
              <div className="text-sm text-muted-foreground">
                {health.isLoading
                  ? "Loading scan health..."
                  : "No scan health available."}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market Price Anomalies</CardTitle>
          <CardDescription>
            Recent NPC and self-market price anomalies retained for{" "}
            {anomalies.data?.retentionDays ?? 90} days. Severe filtering is
            added in the next slice; this view explains what has been recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {anomalies.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {anomalies.error instanceof Error
                  ? anomalies.error.message
                  : "Failed to load market anomalies."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              title="Anomalies"
              value={formatCount(anomalies.data?.summary.total)}
              description="Recent retained records"
            />
            <SummaryCard
              title="Severe"
              value={formatCount(anomalies.data?.summary.bySeverity.severe)}
              description="Would be excluded by severe rules"
            />
            <SummaryCard
              title="Flagged"
              value={formatCount(
                anomalies.data?.summary.byAction.included_flagged,
              )}
              description="Included but visible for review"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Observed</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Observed Price</TableHead>
                <TableHead className="text-right">Reference</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(anomalies.data?.examples ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.scanObservedAt)}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{row.typeId}</TableCell>
                  <TableCell>{row.isBuyOrder ? "BUY" : "SELL"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(row.observedPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(row.referencePrice)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={anomalyBadgeVariant(row.severity)}>
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {row.reasonCode}
                    {row.referenceSource ? ` via ${row.referenceSource}` : ""}
                  </TableCell>
                </TableRow>
              ))}
              {!anomalies.data?.examples.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {anomalies.isLoading
                      ? "Loading anomalies..."
                      : "No anomaly records in the retention window."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function formatBytes(value: string | null | undefined): string {
  if (value == null) return "-";
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatRows(table: MarketSpaceTable): string {
  if (table.rowCountEstimate == null) return "-";
  const count = Number(table.rowCountEstimate);
  const formatted = Number.isFinite(count)
    ? new Intl.NumberFormat().format(count)
    : table.rowCountEstimate;
  return table.rowCountIsEstimate ? `~${formatted}` : formatted;
}

function formatCount(value: number | null | undefined): string {
  return value == null ? "-" : new Intl.NumberFormat().format(value);
}

function formatCoverage(
  summary:
    | {
        unionKeys: number;
        missingNpc: number;
      }
    | null
    | undefined,
): string {
  if (!summary || summary.unionKeys === 0) return "-";
  const covered = summary.unionKeys - summary.missingNpc;
  return `${Math.round((covered / summary.unionKeys) * 100)}%`;
}

function formatIsk(value: string | null): string {
  if (value == null) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(numeric)} ISK`;
}

function formatSignedNumber(value: string | null): string {
  if (value == null) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(numeric);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function getDefaultComparisonRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 13);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPolicy(policy: MarketSpaceTable["retentionPolicy"]): string {
  return policy.replace("-", " ");
}

function formatCategory(category: MarketSpaceTable["category"]): string {
  return category.replace("-", " ");
}

function policyBadgeVariant(policy: MarketSpaceTable["retentionPolicy"]) {
  if (policy === "short-lived") return "secondary";
  if (policy === "planned") return "outline";
  return "default";
}

function healthBadgeVariant(status: "healthy" | "watch" | "missing") {
  if (status === "healthy") return "default";
  if (status === "watch") return "secondary";
  return "outline";
}

function anomalyBadgeVariant(severity: string) {
  if (severity === "severe") return "secondary";
  if (severity === "borderline") return "outline";
  return "default";
}

function readinessBadgeVariant(
  status: "not-ready" | "watch" | "ready-candidate" | undefined,
) {
  if (status === "ready-candidate") return "default";
  if (status === "watch") return "secondary";
  return "outline";
}

