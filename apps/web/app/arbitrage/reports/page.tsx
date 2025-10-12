import * as React from "react";
import { headers } from "next/headers";
import { formatIsk } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { UserRound, CircleHelp } from "lucide-react";

export default async function ArbitrageReportsPage() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const [{ current }, mine] = await Promise.all([
    fetch(`${base}/api/ledger/cycles/overview`, { cache: "no-store" }).then(
      (r) => r.json(),
    ),
    // TODO: pass current user id via session/server; for now allow anonymous = null
    Promise.resolve(
      null as {
        characterName: string;
        amountIsk: string;
        status: string;
        estimatedPayoutIsk?: string;
      } | null,
    ),
  ]);

  const history = current
    ? [
        {
          id: current.id,
          name: current.name ?? current.id,
          invested: current.capital.originalInvestmentISK,
          profit: current.performance.profitISK,
          marginPct: current.performance.marginPct,
        },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <section className="rounded-lg border p-4">
        <h2 className="text-base font-medium">Your participation</h2>
        {mine ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <div>
              Character:{" "}
              <span className="text-foreground">{mine.characterName}</span>
            </div>
            <div>
              Amount: {formatIsk(Number(mine.amountIsk))} • Status:{" "}
              {mine.status.replaceAll("-", " ")}
            </div>
            {typeof mine.estimatedPayoutIsk === "string" && (
              <div>
                Estimated payout (current):{" "}
                {formatIsk(Number(mine.estimatedPayoutIsk))}
              </div>
            )}
          </div>
        ) : (
          <Empty className="mt-2">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRound className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No participation yet</EmptyTitle>
              <EmptyDescription>
                Opt-in to the next cycle to see your stats and estimated payouts
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-base font-medium">Past cycles</h2>
        {history.length === 0 ? (
          <Empty className="mt-2">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleHelp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No history yet</EmptyTitle>
              <EmptyDescription>
                Once there are completed cycles, your past returns will appear
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
      </section>
    </div>
  );
}
