"use client";

import { useRouter } from "next/navigation";
import { useCycleOverview, useAutoRolloverSettings } from "../../api";
import { useCurrentUser } from "../../api/characters/users.hooks";
import type { AutoRolloverSettings } from "@eve/shared/tradecraft-participations";
import { CurrentCycleLoadingSection } from "./sections/current-cycle-loading-section";
import { CurrentCycleOverviewSection } from "./sections/current-cycle-overview-section";
import { CyclesPageHeader } from "./sections/cycles-page-header";
import { NextCycleCard } from "./sections/next-cycle-card";
import { NoCurrentCycleCard } from "./sections/no-current-cycle-card";

export default function CyclesOverviewPageClient() {
  const router = useRouter();

  const { data, isLoading } = useCycleOverview();
  const { data: me } = useCurrentUser();
  const settingsQueryEnabled = Boolean(me?.userId);
  const { data: autoSettings } = useAutoRolloverSettings(settingsQueryEnabled);
  const typedAutoSettings = autoSettings as
    | AutoRolloverSettings
    | null
    | undefined;

  return (
    <div className="p-6 space-y-6">
      <CyclesPageHeader />

      {isLoading ? (
        <CurrentCycleLoadingSection />
      ) : data?.current ? (
        <CurrentCycleOverviewSection
          current={data.current}
          onViewDetails={() => router.push("/tradecraft/cycle-details")}
        />
      ) : (
        <NoCurrentCycleCard />
      )}

      <NextCycleCard
        isLoading={isLoading}
        next={data?.next}
        autoSettings={typedAutoSettings}
        settingsQueryEnabled={settingsQueryEnabled}
      />
    </div>
  );
}
