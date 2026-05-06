"use client";

import * as React from "react";
import { Loader2, Users } from "lucide-react";
import {
  useAllParticipations,
  useUnmatchedDonations,
  useValidateParticipationPayment,
  useRefundParticipation,
  useMarkPayoutSent,
} from "../../../api";
import { ManualCreateParticipationCard } from "../manual-create-participation-card";
import { ParticipationSummaryStats } from "./sections/participation-summary-stats";
import { ParticipantsOverviewCard } from "./sections/participants-overview-card";
import { ManualMatchingCard } from "./sections/manual-matching-card";
import { RefundsCard } from "./sections/refunds-card";
import { PayoutsCard } from "./sections/payouts-card";
import { deriveParticipationBuckets, deriveVisibleCycleIds, groupParticipationsByCycle } from "./lib/derivations";
import {
  confirmParticipationPaid,
  copyToClipboardAndToast,
  markParticipationPayoutSent,
  markRefundSent,
  matchParticipationPayment,
  type SelectedDonation,
} from "./lib/actions";

export default function ParticipationsPageClient() {
  const { data: participations = [], isLoading: loading } = useAllParticipations();
  const { data: unmatchedDonations = [] } = useUnmatchedDonations();

  const validatePayment = useValidateParticipationPayment();
  const refundParticipation = useRefundParticipation();
  const markPayoutSent = useMarkPayoutSent();

  const [selectedParticipation, setSelectedParticipation] = React.useState<string | null>(
    null,
  );
  const [selectedDonation, setSelectedDonation] = React.useState<SelectedDonation | null>(null);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);
  const [showPastCycles, setShowPastCycles] = React.useState(false);

  const clearSelections = React.useCallback(() => {
    setSelectedParticipation(null);
    setSelectedDonation(null);
  }, []);

  const { awaitingPayment, needsRefund, needsPayout } = React.useMemo(
    () => deriveParticipationBuckets(participations),
    [participations],
  );
  const cycles = React.useMemo(() => groupParticipationsByCycle(participations), [participations]);
  const visibleCycleIds = React.useMemo(() => deriveVisibleCycleIds(cycles), [cycles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Participations</h1>
          <p className="text-sm text-muted-foreground">
            Manage cycle participations, payments, refunds, and payouts
          </p>
        </div>
      </div>

      <ManualCreateParticipationCard />

      <ParticipationSummaryStats
        total={participations.length}
        awaitingPayment={awaitingPayment.length}
        needsRefund={needsRefund.length}
        needsPayout={needsPayout.length}
      />

      <ParticipantsOverviewCard
        participationsCount={participations.length}
        cycles={cycles}
        visibleCycleIds={visibleCycleIds}
        showPastCycles={showPastCycles}
        setShowPastCycles={setShowPastCycles}
      />

      <ManualMatchingCard
        awaitingPayment={awaitingPayment}
        unmatchedDonations={unmatchedDonations}
        selectedParticipation={selectedParticipation}
        setSelectedParticipation={setSelectedParticipation}
        selectedDonation={selectedDonation}
        setSelectedDonation={setSelectedDonation}
        onManualMatch={() =>
          matchParticipationPayment({
            selectedParticipation,
            selectedDonation,
            validatePayment: validatePayment.mutateAsync,
            clearSelection: clearSelections,
          })
        }
        onManualConfirmPaid={() =>
          confirmParticipationPaid({
            selectedParticipation,
            validatePayment: validatePayment.mutateAsync,
            clearSelection: () => setSelectedParticipation(null),
          })
        }
        isPending={validatePayment.isPending}
      />

      <RefundsCard
        needsRefund={needsRefund}
        onRefund={(participation) =>
          markRefundSent({
            participation,
            refundParticipation: refundParticipation.mutateAsync,
          })
        }
      />

      <PayoutsCard
        needsPayout={needsPayout}
        copiedText={copiedText}
        onCopy={(text, label) => copyToClipboardAndToast({ text, label, setCopiedText })}
        onMarkPayoutSent={(participation) =>
          markParticipationPayoutSent({
            participation,
            markPayoutSent: markPayoutSent.mutateAsync,
          })
        }
      />
    </div>
  );
}
