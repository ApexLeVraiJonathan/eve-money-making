"use client";

import {
  useCycleOverview,
  useCycleSnapshots,
  useMyParticipation,
} from "../../api";
import {
  getCapitalDistributionData,
  getCapitalOverTimeData,
  getCycleWithParticipation,
  getProfitOverTimeData,
  sortSnapshotsByDate,
} from "./lib/cycle-details-data";
import { CapitalDistributionCard } from "./sections/capital-distribution-card";
import { CapitalOverTimeCard } from "./sections/capital-over-time-card";
import { CycleDetailsHeader } from "./sections/cycle-header";
import { CycleMetricsGrid } from "./sections/cycle-metrics-grid";
import { InvestorInformationCard } from "./sections/investor-information-card";
import { CycleDetailsLoadingState } from "./sections/loading-state";
import { MyParticipationCard } from "./sections/my-participation-card";
import { NoActiveCycleState } from "./sections/no-active-cycle-state";
import { ProfitOverTimeCard } from "./sections/profit-over-time-card";

export default function CycleDetailsPageClient() {
  const { data: overview, isLoading: loading } = useCycleOverview();
  const { data: snapshots = [] } = useCycleSnapshots(
    overview?.current?.id ?? "",
    20,
  );
  const { data: myParticipation } = useMyParticipation(
    overview?.current?.id ?? "",
  );

  const cycle = getCycleWithParticipation(overview, myParticipation);
  const sortedSnapshots = sortSnapshotsByDate(snapshots);
  const pieData = getCapitalDistributionData(cycle);
  const capitalOverTimeData = getCapitalOverTimeData(sortedSnapshots);
  const profitOverTimeData = getProfitOverTimeData(sortedSnapshots);

  if (loading) {
    return <CycleDetailsLoadingState />;
  }

  if (!cycle) {
    return <NoActiveCycleState />;
  }

  return (
    <div className="p-6 space-y-6">
      <CycleDetailsHeader cycle={cycle} />
      <MyParticipationCard cycle={cycle} />
      <CycleMetricsGrid cycle={cycle} />

      <div className="grid gap-4 md:grid-cols-2">
        <CapitalDistributionCard pieData={pieData} />
        <InvestorInformationCard cycle={cycle} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ProfitOverTimeCard data={profitOverTimeData} />
        <CapitalOverTimeCard data={capitalOverTimeData} />
      </div>
    </div>
  );
}
