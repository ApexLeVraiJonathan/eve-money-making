import * as React from "react";
import { headers } from "next/headers";
import { formatIsk } from "@/lib/utils";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CircleHelp } from "lucide-react";

export default async function CycleDetailsPage() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const overviewRes = await fetch(`${base}/api/ledger/cycles/overview`, {
    cache: "no-store",
  });
  const { current } = (await overviewRes.json()) as {
    current: null | {
      id: string;
      name: string | null;
      endsAt: string | null;
      capital: {
        cashISK: number;
        inventoryISK: number;
        originalInvestmentISK: number;
      };
    };
  };
  const cycleName = current?.name ?? current?.id ?? "Current";
  const endsAt = current?.endsAt
    ? new Date(current.endsAt).toLocaleString()
    : "TBD";

  const commitsRes = current
    ? await fetch(
        `${base}/api/ledger/commits/summary?cycleId=${encodeURIComponent(current.id)}`,
        {
          cache: "no-store",
        },
      )
    : null;
  const commits = (await commitsRes?.json()) as
    | Array<{
        id: string;
        name: string;
        openedAt: string;
        closedAt: string | null;
        totals: {
          investedISK: number;
          soldISK: number;
          estSellISK: number;
          estFeesISK: number;
          estProfitISK: number;
          estReturnPct: number;
        };
      }>
    | [];

  if (!current) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cycle details</h1>
        <section className="rounded-lg border p-4 surface-1">
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleHelp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No current cycle</EmptyTitle>
              <EmptyDescription>
                There isn’t an open cycle right now. Please check back later.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cycle details</h1>
      <div className="text-sm text-muted-foreground">
        {cycleName} • Ends {endsAt}
      </div>

      {current && (
        <section className="rounded-lg border p-4 surface-1">
          <h2 className="text-base font-medium">Capital</h2>
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
            <div>
              Original Investment:{" "}
              {formatIsk(current.capital.originalInvestmentISK)}
            </div>
            <div>Cash: {formatIsk(current.capital.cashISK)}</div>
            <div>Inventory: {formatIsk(current.capital.inventoryISK)}</div>
          </div>
        </section>
      )}

      <section className="rounded-lg border p-4 surface-1">
        <h2 className="text-base font-medium">Commits</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Opened</th>
                <th className="p-2">Closed</th>
                <th className="p-2">Invested</th>
                <th className="p-2">Sold</th>
                <th className="p-2">Est. Sell</th>
                <th className="p-2">Est. Fees</th>
                <th className="p-2">Est. Profit</th>
                <th className="p-2">Est. Return</th>
              </tr>
            </thead>
            <tbody>
              {(commits ?? []).map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">
                    {new Date(c.openedAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {c.closedAt
                      ? new Date(c.closedAt).toLocaleString()
                      : "Open"}
                  </td>
                  <td className="p-2">{formatIsk(c.totals.investedISK)}</td>
                  <td className="p-2 text-emerald-500">
                    {formatIsk(c.totals.soldISK)}
                  </td>
                  <td className="p-2 text-yellow-500">
                    {formatIsk(c.totals.estSellISK)}
                  </td>
                  <td className="p-2 text-red-400">
                    {formatIsk(c.totals.estFeesISK)}
                  </td>
                  <td
                    className={`p-2 ${c.totals.estProfitISK < 0 ? "text-red-400" : "text-emerald-500"}`}
                  >
                    {formatIsk(c.totals.estProfitISK)}
                  </td>
                  <td
                    className={`p-2 ${c.totals.estReturnPct < 0 ? "text-red-400" : "text-emerald-500"}`}
                  >
                    {(c.totals.estReturnPct * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
