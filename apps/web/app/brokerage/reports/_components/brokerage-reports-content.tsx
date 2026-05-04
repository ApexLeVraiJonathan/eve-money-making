import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import { formatISK, type Consignment } from "../../_mock/data";

const statuses: readonly Consignment["status"][] = [
  "Awaiting-Contract",
  "Awaiting-Validation",
  "Selling",
  "Closed",
  "Cancelled",
];

export function BrokerageReportsContent({
  consignments,
  dailyPayouts,
  weeklyPayouts,
  statusCounts,
  listedValue,
  realizedISK,
  outstandingISK,
}: {
  consignments: Consignment[];
  dailyPayouts: { date: string; amount: number }[];
  weeklyPayouts: { week: string; total: number }[];
  statusCounts: Record<string, number>;
  listedValue: number;
  realizedISK: number;
  outstandingISK: number;
}) {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <KpiGrid
        total={consignments.length}
        listedValue={listedValue}
        realizedISK={realizedISK}
        outstandingISK={outstandingISK}
      />
      <StatusBreakdown statusCounts={statusCounts} />
      <PayoutTrends dailyPayouts={dailyPayouts} weeklyPayouts={weeklyPayouts} />
      <ConsignmentsTable consignments={consignments} />
    </div>
  );
}

function KpiGrid({
  total,
  listedValue,
  realizedISK,
  outstandingISK,
}: {
  total: number;
  listedValue: number;
  realizedISK: number;
  outstandingISK: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <KpiTile label="Total consignments" value={String(total)} />
      <KpiTile label="Listed value" value={formatISK(listedValue)} />
      <KpiTile
        label="Realized ISK"
        value={formatISK(realizedISK)}
        valueClassName="text-emerald-500"
        help="Payments you have received so far"
      />
      <KpiTile
        label="Outstanding ISK"
        value={formatISK(outstandingISK)}
        valueClassName="text-yellow-500"
      />
    </div>
  );
}

function StatusBreakdown({
  statusCounts,
}: {
  statusCounts: Record<string, number>;
}) {
  return (
    <div className="surface-1 rounded-md border p-4">
      <div className="mb-2 text-sm font-medium">Pipeline status</div>
      <div className="flex flex-wrap gap-2 text-xs">
        {statuses.map((status) => (
          <span
            key={status}
            className={`inline-flex items-center rounded-full border px-3 py-1 ${statusPillStyle(
              status,
            )}`}
          >
            <span className="mr-2 opacity-80">{status}</span>
            <span className="font-semibold">{statusCounts[status] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PayoutTrends({
  dailyPayouts,
  weeklyPayouts,
}: {
  dailyPayouts: { date: string; amount: number }[];
  weeklyPayouts: { week: string; total: number }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PayoutList
        title="Daily payouts"
        rows={dailyPayouts.map((payout) => ({
          label: payout.date,
          value: payout.amount,
        }))}
      />
      <PayoutList
        title="Weekly payouts"
        rows={weeklyPayouts.map((payout) => ({
          label: `Week ${payout.week}`,
          value: payout.total,
        }))}
      />
    </div>
  );
}

function ConsignmentsTable({ consignments }: { consignments: Consignment[] }) {
  return (
    <div className="surface-1 space-y-2 rounded-md border p-4">
      <h2 className="text-lg font-medium">Consignments</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Listed value</TableHead>
            <TableHead className="text-right">Realized</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consignments.map((consignment) => {
            const listed = consignment.items.reduce(
              (sum, item) => sum + item.units * item.unitprice,
              0,
            );
            const realized = consignment.items.reduce(
              (sum, item) => sum + (item.paidOutISK ?? 0),
              0,
            );

            return (
              <TableRow key={consignment.id}>
                <TableCell>
                  <Link
                    href={`/brokerage/consignments/details?id=${encodeURIComponent(
                      consignment.id,
                    )}`}
                    className="underline"
                  >
                    {consignment.id}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[320px] truncate">
                  {consignment.title}
                </TableCell>
                <TableCell>{consignment.status}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatISK(listed)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums text-emerald-500">
                  {formatISK(realized)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PayoutList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="surface-1 space-y-2 rounded-md border p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="surface-2 flex items-center justify-between rounded-md border p-3"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold text-emerald-500">
              {formatISK(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  help,
  valueClassName,
}: {
  label: string;
  value: string;
  help?: string;
  valueClassName?: string;
}) {
  return (
    <div className="surface-1 rounded-md border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${valueClassName ?? ""}`}>
        {value}
      </div>
      {help ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{help}</div>
      ) : null}
    </div>
  );
}

function statusPillStyle(status: Consignment["status"]) {
  switch (status) {
    case "Awaiting-Contract":
      return "border-sky-700/50 bg-sky-950/30 text-sky-400";
    case "Awaiting-Validation":
      return "border-indigo-700/50 bg-indigo-950/30 text-indigo-400";
    case "Selling":
      return "border-emerald-700/50 bg-emerald-950/30 text-emerald-400";
    case "Closed":
      return "border-slate-700/50 bg-slate-950/30 text-slate-300";
    case "Cancelled":
      return "border-rose-700/50 bg-rose-950/30 text-rose-400";
    default:
      return "text-muted-foreground";
  }
}
