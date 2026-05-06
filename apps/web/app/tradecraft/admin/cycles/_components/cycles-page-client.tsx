"use client";

import { useCycleLifecycleAdmin } from "./hooks/use-cycle-lifecycle-admin";
import { CycleCreationCard } from "./sections/cycle-creation-card";
import { CyclesListCard } from "./sections/cycles-list-card";
import { CapitalCard } from "./sections/capital-card";
import { SettlementReportPanel } from "./ui/settlement-report-panel";

export default function CyclesPageClient() {
  const { creationProps, listProps, settlementReportProps, capitalProps } =
    useCycleLifecycleAdmin();

  return (
    <div className="container mx-auto max-w-8xl p-6 space-y-6">
      <CycleCreationCard {...creationProps} />

      <CyclesListCard {...listProps} />

      <SettlementReportPanel {...settlementReportProps} />

      <CapitalCard {...capitalProps} />
    </div>
  );
}
