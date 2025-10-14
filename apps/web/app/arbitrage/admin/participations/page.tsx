"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Link as LinkIcon,
  ArrowLeftRight,
  Ban,
  DollarSign,
  Loader2,
} from "lucide-react";

type Participation = {
  id: string;
  cycleId: string;
  userId: string | null;
  characterName: string;
  amountIsk: string;
  memo: string;
  status: string;
  walletJournalId: string | null;
  validatedAt: string | null;
  optedOutAt: string | null;
  refundAmountIsk: string | null;
  refundedAt: string | null;
  payoutAmountIsk: string | null;
  payoutPaidAt: string | null;
  createdAt: string;
  cycle: {
    id: string;
    name: string | null;
    startedAt: string;
    closedAt: string | null;
  };
};

type UnmatchedDonation = {
  journalId: string;
  characterId: number;
  characterName?: string;
  amount: string;
  description: string | null;
  date: string;
};

export default function ParticipationsPage() {
  const [participations, setParticipations] = React.useState<Participation[]>(
    [],
  );
  const [unmatchedDonations, setUnmatchedDonations] = React.useState<
    UnmatchedDonation[]
  >([]);
  const [selectedParticipation, setSelectedParticipation] = React.useState<
    string | null
  >(null);
  const [selectedDonation, setSelectedDonation] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [matching, setMatching] = React.useState(false);

  React.useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all participations (AWAITING_INVESTMENT + OPTED_OUT with no refund)
      const pRes = await fetch("/api/ledger/participations/all");
      if (pRes.ok) {
        const data = await pRes.json();
        setParticipations(data);
      }

      // Load unmatched donations
      const dRes = await fetch(
        "/api/ledger/participations/unmatched-donations",
      );
      if (dRes.ok) {
        const data = await dRes.json();
        setUnmatchedDonations(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedParticipation || !selectedDonation) {
      toast.error("Please select both a participation and a donation");
      return;
    }

    setMatching(true);
    try {
      const donation = unmatchedDonations.find(
        (d) => d.journalId === selectedDonation,
      );
      if (!donation) throw new Error("Donation not found");

      const res = await fetch(
        `/api/ledger/participations/${selectedParticipation}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletJournal: {
              characterId: donation.characterId,
              journalId: BigInt(donation.journalId),
            },
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to match");

      toast.success("Payment matched successfully!");
      setSelectedParticipation(null);
      setSelectedDonation(null);
      await loadData();
    } catch (error) {
      toast.error("Failed to match payment");
    } finally {
      setMatching(false);
    }
  };

  const formatIsk = (value: string) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AWAITING_INVESTMENT":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
            Awaiting Payment
          </Badge>
        );
      case "OPTED_IN":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600"
          >
            Confirmed
          </Badge>
        );
      case "OPTED_OUT":
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
            Cancelled
          </Badge>
        );
      case "REFUNDED":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter participations
  const awaitingPayment = participations.filter(
    (p) => p.status === "AWAITING_INVESTMENT",
  );
  const needsRefund = participations.filter(
    (p) => p.status === "OPTED_OUT" && !p.refundedAt,
  );
  const needsPayout = participations.filter(
    (p) =>
      p.status === "OPTED_IN" &&
      p.cycle.closedAt &&
      !p.payoutPaidAt &&
      p.payoutAmountIsk,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Participations</h1>
        <p className="text-muted-foreground">
          Manage cycle participations, payments, refunds, and payouts
        </p>
      </div>

      {/* Manual Matching Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Manual Payment Matching
          </CardTitle>
          <CardDescription>
            Select a participation and a donation to manually link them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Participations Column */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Awaiting Payment ({awaitingPayment.length})
              </h3>
              <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                {awaitingPayment.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No participations awaiting payment
                  </div>
                ) : (
                  <div className="divide-y">
                    {awaitingPayment.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedParticipation(p.id)}
                        className={`p-3 cursor-pointer transition-colors ${
                          selectedParticipation === p.id
                            ? "bg-primary/10 border-l-4 border-l-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {p.characterName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatIsk(p.amountIsk)} ISK
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-1">
                          {p.memo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Donations Column */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Unmatched Donations ({unmatchedDonations.length})
              </h3>
              <div className="rounded-lg border max-h-[400px] overflow-y-auto">
                {unmatchedDonations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No unmatched donations
                  </div>
                ) : (
                  <div className="divide-y">
                    {unmatchedDonations.map((d) => (
                      <div
                        key={d.journalId}
                        onClick={() => setSelectedDonation(d.journalId)}
                        className={`p-3 cursor-pointer transition-colors ${
                          selectedDonation === d.journalId
                            ? "bg-primary/10 border-l-4 border-l-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {d.characterName || `Character ${d.characterId}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatIsk(d.amount)} ISK
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-1">
                          {d.description || "(no memo)"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(d.date).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center">
            <Button
              onClick={handleManualMatch}
              disabled={!selectedParticipation || !selectedDonation || matching}
              className="gap-2"
            >
              {matching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4" />
                  Link Selected Payment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Refunds Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Refunds Needed ({needsRefund.length})
          </CardTitle>
          <CardDescription>
            Participations that have been cancelled and need refunds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsRefund.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Ban className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">No refunds needed</h3>
              <p className="text-sm text-muted-foreground">
                All cancelled participations have been refunded
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Character</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Cycle</th>
                    <th className="text-left p-3 font-medium">Cancelled</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {needsRefund.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="p-3 font-medium">{p.characterName}</td>
                      <td className="p-3 text-right font-mono">
                        {formatIsk(p.amountIsk)} ISK
                      </td>
                      <td className="p-3">{p.cycle.name || p.cycle.id}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(p.optedOutAt!).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Mark ${formatIsk(p.amountIsk)} ISK refund as sent to ${p.characterName}?`,
                            );
                            if (!confirmed) return;

                            try {
                              const res = await fetch(
                                `/api/ledger/participations/${p.id}/refund`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    amountIsk: p.amountIsk,
                                  }),
                                },
                              );
                              if (!res.ok) throw new Error("Failed");
                              toast.success("Refund marked as sent!");
                              await loadData();
                            } catch {
                              toast.error("Failed to mark refund");
                            }
                          }}
                        >
                          Mark Refund Sent
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payouts Needed ({needsPayout.length})
          </CardTitle>
          <CardDescription>
            Completed cycle participations awaiting payout
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsPayout.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">No payouts pending</h3>
              <p className="text-sm text-muted-foreground">
                All cycle payouts have been processed
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Character</th>
                    <th className="text-right p-3 font-medium">Investment</th>
                    <th className="text-right p-3 font-medium">Payout</th>
                    <th className="text-left p-3 font-medium">Cycle</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {needsPayout.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="p-3 font-medium">{p.characterName}</td>
                      <td className="p-3 text-right font-mono">
                        {formatIsk(p.amountIsk)} ISK
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                        {formatIsk(p.payoutAmountIsk!)} ISK
                      </td>
                      <td className="p-3">{p.cycle.name || p.cycle.id}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Mark ${formatIsk(p.payoutAmountIsk!)} ISK payout as sent to ${p.characterName}?`,
                            );
                            if (!confirmed) return;

                            try {
                              const res = await fetch(
                                `/api/ledger/participations/${p.id}/mark-payout-sent`,
                                {
                                  method: "POST",
                                },
                              );
                              if (!res.ok) throw new Error("Failed");
                              toast.success("Payout marked as sent!");
                              await loadData();
                            } catch {
                              toast.error("Failed to mark payout");
                            }
                          }}
                        >
                          Mark Payout Sent
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
