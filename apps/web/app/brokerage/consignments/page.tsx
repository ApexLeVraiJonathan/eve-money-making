"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { useMemo } from "react";
import { formatISK, type Consignment } from "../_mock/data";
import { useQuery } from "@tanstack/react-query";
import { consignmentsQueryKey, listConsignments } from "../_mock/store";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hubs are displayed in dedicated sections; no filter needed

export default function ConsignmentsListPage() {
  const { data: allConsignments = [], isLoading } = useQuery<Consignment[]>({
    queryKey: consignmentsQueryKey,
    queryFn: listConsignments,
  });

  const groups = useMemo(() => {
    const by: Record<string, Consignment[]> = { "Jita 4-4": [], "C-N": [] };
    allConsignments.forEach((c) => by[c.hub]?.push(c));
    return by;
  }, [allConsignments]);

  const renderGroup = (groupHub: "Jita 4-4" | "C-N") => {
    const list = groups[groupHub] ?? [];
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {groupHub}
        </h2>
        {list.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No consignments</EmptyTitle>
              <EmptyDescription>
                Start by creating a new consignment for {groupHub}.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/brokerage/consignments/new" className="underline">
                Create Consignment
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {list.map((c) => {
              const est = c.items.reduce(
                (s, it) => s + it.units * it.unitprice,
                0,
              );
              return (
                <Link
                  key={c.id}
                  href={`/brokerage/consignments/details?id=${encodeURIComponent(
                    c.id,
                  )}`}
                  className="block hover:no-underline"
                >
                  <Card className="h-full hover:bg-white/5 transition-colors surface-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold inline-flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        {c.title}
                      </CardTitle>
                      <div className="text-sm flex items-center gap-2">
                        {new Date(c.createdAt).toLocaleDateString()} •
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
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
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="flex items-center justify-between">
                        <span>Items {c.items.length}</span>
                        <span>
                          Estimated{" "}
                          <span className="text-emerald-500">
                            {formatISK(est)}
                          </span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    );
  };

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
      {/* Hub filter removed; sections below show each hub separately */}

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {renderGroup("Jita 4-4")}

      <Separator className="my-2" />

      {renderGroup("C-N")}
    </div>
  );
}
