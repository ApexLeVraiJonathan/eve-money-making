import {
  MOCK_CONSIGNMENTS,
  MOCK_DAILY_PAYOUTS,
  formatISK,
  type Consignment,
} from "../_mock/data";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";

export default function BrokerageReportsPage() {
  const consignments: Consignment[] = MOCK_CONSIGNMENTS;

  // Derived values
  const statusCounts = consignments.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const listedValue = consignments.reduce((sum, c) => {
    // Sum of units * unitprice for items in selling/awaiting states
    const include =
      c.status === "Selling" ||
      c.status === "Awaiting-Contract" ||
      c.status === "Awaiting-Validation";
    if (!include) return sum;
    const itemsTotal = c.items.reduce(
      (s, it) => s + it.units * it.unitprice,
      0,
    );
    return sum + itemsTotal;
  }, 0);

  const realizedISK = consignments.reduce((sum, c) => {
    return sum + c.items.reduce((s, it) => s + (it.paidOutISK ?? 0), 0);
  }, 0);

  const outstandingISK = Math.max(0, listedValue - realizedISK);

  // Weekly totals from daily mock
  const byWeek = groupByWeek(
    MOCK_DAILY_PAYOUTS.map((d) => ({ date: d.date, amount: d.amount })),
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      {/* KPI Tiles */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-4 surface-1">
          <KpiTile
            label="Total consignments"
            value={String(consignments.length)}
          />
        </div>
        <div className="rounded-md border p-4 surface-1">
          <KpiTile label="Listed value" value={formatISK(listedValue)} />
        </div>
        <div className="rounded-md border p-4 surface-1">
          <KpiTile
            label="Realized ISK"
            value={formatISK(realizedISK)}
            valueClassName="text-emerald-500"
            help="Payments you’ve received so far"
          />
        </div>
        <div className="rounded-md border p-4 surface-1">
          <KpiTile
            label="Outstanding ISK"
            value={formatISK(outstandingISK)}
            valueClassName="text-yellow-500"
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="rounded-md border p-4 surface-1">
        <div className="text-sm font-medium mb-2">Pipeline status</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              "Awaiting-Contract",
              "Awaiting-Validation",
              "Selling",
              "Closed",
              "Cancelled",
            ] as const
          ).map((s) => (
            <span
              key={s}
              className={`inline-flex items-center rounded-full border px-3 py-1 ${statusPillStyle(
                s,
              )}`}
            >
              <span className="mr-2 opacity-80">{s}</span>
              <span className="font-semibold">{statusCounts[s] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 surface-1 rounded-md border p-4">
          <h2 className="text-lg font-medium">Daily payouts</h2>
          <div className="grid gap-2 text-sm">
            {MOCK_DAILY_PAYOUTS.map((p) => (
              <div
                key={p.date}
                className="flex items-center justify-between rounded-md border p-3 surface-2"
              >
                <span className="text-muted-foreground">{p.date}</span>
                <span className="font-semibold text-emerald-500">
                  {formatISK(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2 surface-1 rounded-md border p-4">
          <h2 className="text-lg font-medium">Weekly payouts</h2>
          <div className="grid gap-2 text-sm">
            {byWeek.map((w) => (
              <div
                key={w.week}
                className="flex items-center justify-between rounded-md border p-3 surface-2"
              >
                <span className="text-muted-foreground">Week {w.week}</span>
                <span className="font-semibold text-emerald-500">
                  {formatISK(w.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table with jump links */}
      <div className="space-y-2 surface-1 rounded-md border p-4">
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
            {consignments.map((c) => {
              const listed = c.items.reduce(
                (s, it) => s + it.units * it.unitprice,
                0,
              );
              const realized = c.items.reduce(
                (s, it) => s + (it.paidOutISK ?? 0),
                0,
              );
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/brokerage/consignments/details?id=${encodeURIComponent(
                        c.id,
                      )}`}
                      className="underline"
                    >
                      {c.id}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate max-w-[320px]">
                    {c.title}
                  </TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatISK(listed)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-emerald-500 font-semibold">
                    {formatISK(realized)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${valueClassName ?? ""}`}>
        {value}
      </div>
      {help ? (
        <div className="text-[11px] text-muted-foreground mt-1">{help}</div>
      ) : null}
    </div>
  );
}

function groupByWeek(dailies: { date: string; amount: number }[]) {
  const weeks = new Map<string, number>();
  for (const { date, amount } of dailies) {
    const d = new Date(date);
    // ISO week number (YYYY-Www)
    const week = isoWeekKey(d);
    weeks.set(week, (weeks.get(week) ?? 0) + amount);
  }
  return Array.from(weeks.entries()).map(([week, total]) => ({ week, total }));
}

function isoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function statusPillStyle(s: Consignment["status"]) {
  switch (s) {
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
