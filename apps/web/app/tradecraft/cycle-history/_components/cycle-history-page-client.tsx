"use client";

import { useCycleHistory } from "../../api";
import { buildCycleHistoryMetrics } from "./lib/cycle-history-metrics";
import { CycleHistoryEmptyState } from "./sections/cycle-history-empty-state";
import { CycleHistoryHeader } from "./sections/cycle-history-header";
import { CycleHistoryLoadingState } from "./sections/cycle-history-loading-state";
import { CycleHistoryStatsGrid } from "./sections/cycle-history-stats-grid";
import { CycleHistoryTableSection } from "./sections/cycle-history-table-section";

export default function CycleHistoryPageClient() {
  const { data: cycles = [], isLoading: loading } = useCycleHistory();
  const metrics = buildCycleHistoryMetrics(cycles);

  if (loading) {
    return <CycleHistoryLoadingState />;
  }

  return (
    <div className="p-6 space-y-6">
      <CycleHistoryHeader />

      {cycles.length === 0 ? (
        <CycleHistoryEmptyState />
      ) : (
        <>
          <CycleHistoryStatsGrid metrics={metrics} />
          <CycleHistoryTableSection cycles={cycles} />
        </>
      )}
    </div>
  );
}
