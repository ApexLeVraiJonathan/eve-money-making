"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { useCycles, useCycleLinesIntel } from "../../../api";
import { DestinationAccordion, IntelBlock } from "./sections/intel-sections";

export default function CycleIntelPageClient() {
  const searchParams = useSearchParams();
  const queryParamCycleId = searchParams.get("cycleId");

  const [cycleId, setCycleId] = React.useState<string>("");
  const [tab, setTab] = React.useState<"global" | "destination">("global");

  const { data: cycles = [] } = useCycles();
  const { data: intel, isLoading, error } = useCycleLinesIntel(cycleId);

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
                    {c.name ?? c.id.slice(0, 8)} {c.status === "OPEN" ? "• OPEN" : ""}
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
