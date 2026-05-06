"use client";

import { History } from "lucide-react";

export function CycleHistoryHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historical performance across all completed tradecraft cycles
          </p>
        </div>
      </div>
    </div>
  );
}
