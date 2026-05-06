"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { consignmentsQueryKey, listConsignments } from "../../../_mock/store";
import { type Consignment, formatISK } from "../../../_mock/data";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";

function DetailsInner() {
  const params = useSearchParams();
  const initialId = params.get("id");
  const { data: consignments = [] } = useQuery<Consignment[]>({
    queryKey: consignmentsQueryKey,
    queryFn: listConsignments,
  });

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const selected = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return consignments.find((c) => c.id === selectedId) ?? null;
  }, [selectedId, consignments]);

  const totals = useMemo(() => {
    if (!selected) {
      return { paid: 0, left: 0 };
    }
    const paid = selected.items.reduce((sum, item) => sum + (item.paidOutISK ?? 0), 0);
    const totalEst = selected.items.reduce(
      (sum, item) => sum + item.units * item.unitprice,
      0,
    );
    const estimatedSold = selected.items.reduce(
      (sum, item) => sum + (item.unitsSold ?? 0) * item.unitprice,
      0,
    );
    const left = Math.max(0, totalEst - estimatedSold);
    return { paid, left };
  }, [selected]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Consignment Details
        </h1>
        <Link href="/brokerage/consignments" className="text-sm underline">
          Back to list
        </Link>
      </div>

      {!selected && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Select a consignment to view details.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {consignments.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="rounded-md border p-3 text-left hover:bg-white/7 surface-1"
              >
                <div className="font-medium">{c.title}</div>
                <div className="flex items-center gap-2 text-xs">
                  {new Date(c.createdAt).toLocaleDateString()} •
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                      c.status === "Selling"
                        ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-400"
                        : c.status === "Awaiting-Contract"
                          ? "border-sky-700/50 bg-sky-950/30 text-sky-400"
                          : c.status === "Awaiting-Validation"
                            ? "border-indigo-700/50 bg-indigo-950/30 text-indigo-400"
                            : c.status === "Closed"
                              ? "border-slate-700/50 bg-slate-950/30 text-slate-300"
                              : "border-rose-700/50 bg-rose-950/30 text-rose-400"
                    }`}
                  >
                    {c.status}
                  </span>
                  • {c.hub}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-2">
          <div className="text-lg font-semibold">{selected.title}</div>
          <div className="text-sm">
            {new Date(selected.createdAt).toLocaleDateString()} • {selected.status}
            {" • "}
            {selected.hub}
          </div>

          <div className="overflow-x-auto rounded-md border p-3 surface-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Units to sell</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                  <TableHead className="text-right">Paid out (ISK)</TableHead>
                  <TableHead className="text-right">
                    Est. left to sell (ISK)
                  </TableHead>
                  <TableHead className="text-right">Est. net (ISK)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.items.map((item, idx) => {
                  const unitsSold = item.unitsSold ?? 0;
                  const unitsLeft = Math.max(0, item.units - unitsSold);
                  const paid = item.paidOutISK ?? 0;
                  const estLeft = Math.max(0, unitsLeft * item.unitprice);
                  const estNet = item.units * item.unitprice;
                  return (
                    <TableRow key={`${item.type_name}-${idx}`}>
                      <TableCell>{item.type_name}</TableCell>
                      <TableCell className="text-right">
                        {unitsSold.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {unitsLeft.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {item.lastUpdatedAt
                          ? new Date(item.lastUpdatedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-emerald-500">
                        {formatISK(paid)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatISK(estLeft)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatISK(estNet)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-500">
                    {formatISK(totals.paid)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatISK(totals.left)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsignmentDetailsPageClient() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <DetailsInner />
    </Suspense>
  );
}
