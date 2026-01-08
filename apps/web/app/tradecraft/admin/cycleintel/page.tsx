"use client";

// Mark as dynamic since we use useSearchParams
export const dynamic = "force-dynamic";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Skeleton } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import { useCycles, useCycleLinesIntel } from "../../api";
import type { CycleLinesIntelRow, CycleLinesIntelTotals } from "@eve/shared";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import { ChevronDown } from "lucide-react";

export default function CycleLinesPage() {
  return (
    <React.Suspense fallback={<div className="p-6">Loading...</div>}>
      <CycleLinesContent />
    </React.Suspense>
  );
}

function CycleLinesContent() {
  const searchParams = useSearchParams();
  const queryParamCycleId = searchParams.get("cycleId");

  const [cycleId, setCycleId] = React.useState<string>("");
  const [tab, setTab] = React.useState<"global" | "destination">("global");

  const { data: cycles = [] } = useCycles();
  const { data: intel, isLoading, error } = useCycleLinesIntel(cycleId);

  // Auto-select latest cycle
  React.useEffect(() => {
    if (queryParamCycleId) {
      setCycleId(queryParamCycleId);
    } else if (cycles.length > 0 && !cycleId) {
      const openCycle = cycles.find((c) => c.status === "OPEN");
      setCycleId(openCycle?.id || cycles[0].id);
    }
  }, [queryParamCycleId, cycles, cycleId]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cycle Intel</h1>
          <p className="text-sm text-muted-foreground">
            Global and destination-level profitability for a cycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-[260px]">
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.id.slice(0, 8)}{" "}
                    {c.status === "OPEN" ? "• OPEN" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      ) : !intel ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Select a cycle to continue.</p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="global">Global View</TabsTrigger>
            <TabsTrigger value="destination">Destination View</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-4 space-y-4">
            <IntelBlock
              title="Global View"
              description="Aggregated across all destinations (grouped by item)."
              profitableLabel="Completed profitable items (sold out)"
              potentialLabel="Potential profit (listed above break-even)"
              redLabel="Red items (negative margin at market)"
              block={intel.global}
              showDestination={false}
              variant="global"
            />
          </TabsContent>

          <TabsContent value="destination" className="mt-4 space-y-4">
            <DestinationAccordion destinations={intel.destinations} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function TotalsRow({
  label,
  value,
  className,
  colSpan,
}: {
  label: string;
  value: number;
  className: string;
  colSpan: number;
}) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={colSpan} className="text-right font-medium">
        {label}
      </TableCell>
      <TableCell
        className={`text-right tabular-nums font-semibold ${className}`}
      >
        {formatIsk(value)}
      </TableCell>
    </TableRow>
  );
}

function ProfitTable({
  rows,
  totals,
}: {
  rows: CycleLinesIntelRow[];
  totals: CycleLinesIntelTotals;
}) {
  const totalProfit = Number(totals.profitIsk);
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Bought</TableHead>
            <TableHead className="text-right">Sold</TableHead>
            <TableHead className="text-right">COGS</TableHead>
            <TableHead className="text-right">Sales Net</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="text-right">Profit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-6 text-center text-muted-foreground"
              >
                No items.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const profit = Number(r.profitIsk);
              return (
                <TableRow key={`${r.destinationStationId ?? "g"}:${r.typeId}`}>
                  <TableCell className="font-medium">
                    <div className="text-sm">{r.typeName}</div>
                    <div className="text-xs text-muted-foreground">
                      ({r.typeId})
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.unitsBought.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.unitsSold.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(Number(r.cogsSoldIsk))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(Number(r.salesNetIsk))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(Number(r.feesIsk))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        profit >= 0 ? "text-emerald-500" : "text-red-400"
                      }
                    >
                      {formatIsk(profit)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
          <TotalsRow
            label="Total Profit"
            value={totalProfit}
            className={totalProfit >= 0 ? "text-emerald-500" : "text-red-400"}
            colSpan={6}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function PotentialTable({
  rows,
  totals,
  variant,
}: {
  rows: CycleLinesIntelRow[];
  totals: CycleLinesIntelTotals;
  variant: "global" | "destination";
}) {
  const totalExpected = Number(totals.expectedProfitIsk ?? 0);
  const showListed = variant === "destination";
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="text-right">WAC</TableHead>
            <TableHead className="text-right">Inv. Cost</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            {showListed && (
              <TableHead className="text-right">Listed @</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showListed ? 6 : 5}
                className="py-6 text-center text-muted-foreground"
              >
                No items.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.destinationStationId ?? "g"}:${r.typeId}`}>
                <TableCell className="font-medium">
                  <div className="text-sm">{r.typeName}</div>
                  <div className="text-xs text-muted-foreground">
                    ({r.typeId})
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.unitsRemaining.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(r.wacUnitCostIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(r.inventoryCostRemainingIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="text-emerald-500">
                    {formatIsk(Number(r.expectedProfitIsk ?? 0))}
                  </span>
                </TableCell>
                {showListed && (
                  <TableCell className="text-right tabular-nums">
                    {r.currentSellPriceIsk
                      ? formatIsk(Number(r.currentSellPriceIsk))
                      : "—"}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
          <TotalsRow
            label="Total Expected Profit"
            value={totalExpected}
            className={totalExpected >= 0 ? "text-emerald-500" : "text-red-400"}
            colSpan={showListed ? 5 : 4}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function RedTable({
  rows,
  totals,
  variant,
}: {
  rows: CycleLinesIntelRow[];
  totals: CycleLinesIntelTotals;
  variant: "global" | "destination";
}) {
  const totalLoss = Number(totals.lossIsk ?? 0);
  const showMarketCols = variant === "destination";
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Rollover</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="text-right">WAC</TableHead>
            <TableHead className="text-right">Loss @ market</TableHead>
            {showMarketCols && (
              <>
                <TableHead className="text-right">Market low</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showMarketCols ? 7 : 5}
                className="py-6 text-center text-muted-foreground"
              >
                No items.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.destinationStationId ?? "g"}:${r.typeId}`}>
                <TableCell className="font-medium">
                  <div className="text-sm">{r.typeName}</div>
                  <div className="text-xs text-muted-foreground">
                    ({r.typeId})
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.isRollover === undefined ? (
                    <span className="rounded border px-2 py-0.5">Mixed</span>
                  ) : r.isRollover ? (
                    <span className="rounded border px-2 py-0.5">Yes</span>
                  ) : (
                    <span className="rounded border px-2 py-0.5">No</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.unitsRemaining.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatIsk(Number(r.wacUnitCostIsk))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="text-red-400">
                    {formatIsk(Number(r.estimatedProfitAtMarketIsk ?? 0))}
                  </span>
                </TableCell>
                {showMarketCols && (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {r.marketLowSellIsk
                        ? formatIsk(Number(r.marketLowSellIsk))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.estimatedMarginPercentAtMarket ?? "—"}%
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
          <TotalsRow
            label="Total Loss"
            value={totalLoss}
            className="text-red-400"
            colSpan={showMarketCols ? 6 : 4}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function IntelBlock({
  title,
  description,
  profitableLabel,
  potentialLabel,
  redLabel,
  block,
  variant = "destination",
}: {
  title: string;
  description: string;
  profitableLabel: string;
  potentialLabel: string;
  redLabel: string;
  showDestination: boolean;
  block: {
    profitable: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
    potential: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
    red: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
  };
  variant?: "global" | "destination";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold">{profitableLabel}</div>
          <ProfitTable
            rows={block.profitable.rows}
            totals={block.profitable.totals}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{potentialLabel}</div>
          <PotentialTable
            rows={block.potential.rows}
            totals={block.potential.totals}
            variant={variant}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{redLabel}</div>
          <RedTable
            rows={block.red.rows}
            totals={block.red.totals}
            variant={variant}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DestinationAccordion({
  destinations,
}: {
  destinations: Array<{
    destinationStationId: number;
    destinationStationName: string;
    profitable: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
    potential: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
    red: { rows: CycleLinesIntelRow[]; totals: CycleLinesIntelTotals };
  }>;
}) {
  const ordered = React.useMemo(() => {
    const order = ["Dodixie", "Hek", "Rens", "Amarr"];
    const idxFor = (name: string) => {
      const i = order.findIndex((x) => name.includes(x));
      return i === -1 ? 999 : i;
    };
    return [...destinations].sort((a, b) => {
      const ai = idxFor(a.destinationStationName);
      const bi = idxFor(b.destinationStationName);
      if (ai !== bi) return ai - bi;
      return a.destinationStationName.localeCompare(b.destinationStationName);
    });
  }, [destinations]);

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No destinations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.map((d) => {
        const profit = Number(d.profitable.totals.profitIsk);
        const expected = Number(d.potential.totals.expectedProfitIsk ?? 0);
        const loss = Number(d.red.totals.lossIsk ?? 0);
        return (
          <Collapsible key={d.destinationStationId} defaultOpen={false}>
            <div className="rounded-lg border overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-medium">
                      {d.destinationStationName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Station #{d.destinationStationId}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <div>
                      <span className="text-muted-foreground">Profit </span>
                      <span
                        className={
                          profit >= 0 ? "text-emerald-500" : "text-red-400"
                        }
                      >
                        {formatIsk(profit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected </span>
                      <span
                        className={
                          expected >= 0 ? "text-emerald-500" : "text-red-400"
                        }
                      >
                        {formatIsk(expected)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Loss </span>
                      <span className="text-red-400">{formatIsk(loss)}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="p-4">
                  <IntelBlock
                    title={d.destinationStationName}
                    description={`Station #${d.destinationStationId}`}
                    profitableLabel="Completed profitable items (sold out)"
                    potentialLabel="Potential profit (remaining listed above break-even)"
                    redLabel="Red items (negative margin at market)"
                    block={d}
                    showDestination={false}
                    variant="destination"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
