import * as React from "react";
import { formatIsk } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@eve/ui";
import { CircleHelp } from "lucide-react";

type HistoryCycle = {
  id: string;
  name: string;
  invested: number;
  profit: number;
  marginPct: number;
};

export default async function ArbitrageHistoryPage() {
  const history: HistoryCycle[] = [];
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cycle history</h1>
      {history.length === 0 ? (
        <section className="rounded-lg border p-4 surface-1">
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleHelp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No history yet</EmptyTitle>
              <EmptyDescription>
                Past cycles will appear here once completed. Please check back
                later.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Cycle</th>
                <th className="p-2 text-right">Investment</th>
                <th className="p-2 text-right">Profit</th>
                <th className="p-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t hover:bg-muted/50">
                  <td className="p-2">{h.name}</td>
                  <td className="p-2 text-right tabular-nums">
                    {formatIsk(h.invested)}
                  </td>
                  <td
                    className={`p-2 text-right tabular-nums ${h.profit < 0 ? "text-red-400" : h.profit > 0 ? "text-emerald-500" : ""}`}
                  >
                    {formatIsk(h.profit)}
                  </td>
                  <td
                    className={`p-2 text-right tabular-nums ${h.marginPct < 0 ? "text-red-400" : h.marginPct > 0 ? "text-emerald-500" : ""}`}
                  >
                    {(h.marginPct * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
