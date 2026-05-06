"use client";

import { Skeleton } from "@eve/ui";

export function CycleHistoryLoadingState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32" />
        ))}
      </div>
    </div>
  );
}
