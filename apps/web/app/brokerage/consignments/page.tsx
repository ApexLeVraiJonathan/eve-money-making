"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MOCK_CONSIGNMENTS, formatISK } from "../_mock/data";

const HUBS = ["All", "Jita 4-4", "C-N"] as const;
const STRATEGIES = [
  "All",
  "Client fixed price",
  "Cheapest (no repricing)",
  "Cheapest + daily",
  "Cheapest + 2x daily",
  "Cheapest + 3x daily",
] as const;

export default function ConsignmentsListPage() {
  const [hub, setHub] = useState<(typeof HUBS)[number]>("All");
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]>("All");
  const consignments = useMemo(() => {
    return MOCK_CONSIGNMENTS.filter(
      (c) =>
        (hub === "All" || c.hub === hub) &&
        (strategy === "All" || c.strategy === strategy)
    );
  }, [hub, strategy]);
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Consignments</h1>
        <Link
          href="/brokerage/consignments/new"
          className="text-sm underline underline-offset-4"
        >
          New consignment
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-muted-foreground">Hub</span>
          <select
            className="border rounded-md px-3 h-9 bg-transparent"
            value={hub}
            onChange={(e) => setHub(e.target.value as (typeof HUBS)[number])}
          >
            {HUBS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-muted-foreground">Strategy</span>
          <select
            className="border rounded-md px-3 h-9 bg-transparent"
            value={strategy}
            onChange={(e) =>
              setStrategy(e.target.value as (typeof STRATEGIES)[number])
            }
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3">
        {consignments.map((c) => (
          <Link
            key={c.id}
            href={`/brokerage/consignments/${c.id}`}
            className="rounded-md border p-4 hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c.hub} • {c.strategy} • Fee {c.feePercent}%
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>Estimated {formatISK(c.estimatedValue)}</div>
                <div>Realized {formatISK(c.realizedValue)}</div>
                <div>Left {formatISK(c.leftToSell)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
