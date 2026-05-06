import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import type { CycleLinesIntelRow, CycleLinesIntelTotals } from "@eve/shared/tradecraft-cycles";

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
      <TableCell className={`text-right tabular-nums font-semibold ${className}`}>
        {formatIsk(value)}
      </TableCell>
    </TableRow>
  );
}

export function ProfitTable({
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
              <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
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
                    <div className="text-xs text-muted-foreground">({r.typeId})</div>
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
                    <span className={profit >= 0 ? "text-emerald-500" : "text-red-400"}>
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

export function PotentialTable({
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
            {showListed && <TableHead className="text-right">Listed @</TableHead>}
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
                  <div className="text-xs text-muted-foreground">({r.typeId})</div>
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
                    {r.currentSellPriceIsk ? formatIsk(Number(r.currentSellPriceIsk)) : "—"}
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

export function RedTable({
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
                  <div className="text-xs text-muted-foreground">({r.typeId})</div>
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
                      {r.marketLowSellIsk ? formatIsk(Number(r.marketLowSellIsk)) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.estimatedMarginPercentAtMarket ?? "—"}%
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
          <TotalsRow label="Total Loss" value={totalLoss} className="text-red-400" colSpan={showMarketCols ? 6 : 4} />
        </TableBody>
      </Table>
    </div>
  );
}
