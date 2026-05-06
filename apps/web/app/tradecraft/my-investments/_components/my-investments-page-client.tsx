"use client";

import { useRouter } from "next/navigation";
import { useMyParticipationHistory, useMyJingleYieldStatus } from "../../api";
import {
  startUserLogin,
  useCurrentUser,
} from "../../api/characters/users.hooks";
import { calculateInvestmentsMetrics } from "./lib/investment-metrics";
import { AuthRequiredSection } from "./sections/auth-required-section";
import { InvestmentHistoryTable } from "./sections/investment-history-table";
import { InvestmentStatsGrid } from "./sections/investment-stats-grid";
import { JingleYieldPromotionCard } from "./sections/jingle-yield-promotion-card";
import { MyInvestmentsHeader } from "./sections/my-investments-header";
import { MyInvestmentsLoadingState } from "./sections/my-investments-loading-state";
import { NoInvestmentsSection } from "./sections/no-investments-section";

export default function MyInvestmentsPageClient() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();
  const {
    data: participations = [],
    isLoading: loading,
    error,
  } = useMyParticipationHistory();
  const { data: jingleStatus } = useMyJingleYieldStatus();

  const authRequired = (!userLoading && !currentUser) || !!error;
  const metrics = calculateInvestmentsMetrics(participations);

  if (!currentUser || authRequired) {
    return (
      <div className="p-6 space-y-6">
        <MyInvestmentsHeader />
        <AuthRequiredSection
          onSignIn={() => {
            const returnUrl =
              typeof window !== "undefined"
                ? window.location.href
                : "/tradecraft/my-investments";
            startUserLogin(returnUrl);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <MyInvestmentsLoadingState />
      </div>
    );
  }

  if (participations.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <MyInvestmentsHeader />
        <NoInvestmentsSection
          onViewCycles={() => router.push("/tradecraft/cycles")}
          onViewHistory={() => router.push("/tradecraft/cycle-history")}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <MyInvestmentsHeader />
      {jingleStatus ? <JingleYieldPromotionCard status={jingleStatus} /> : null}
      <InvestmentStatsGrid metrics={metrics} />
      <InvestmentHistoryTable participations={participations} />
    </div>
  );
}
