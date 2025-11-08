"use client";

import * as React from "react";
import { Button } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Badge } from "@eve/ui";
import { toast } from "sonner";
import {
  Users,
  Link as LinkIcon,
  ArrowLeftRight,
  Ban,
  DollarSign,
  Loader2,
  Copy,
  Check,
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
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      toast.success(`Copied ${label}!`);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

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
      } else if (pRes.status === 401) {
        toast.error("Please sign in to access this page");
        return;
      } else {
        const error = await pRes
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Failed to load participations:", error);
        toast.error("Failed to load participations");
      }

      // Load unmatched donations
      const dRes = await fetch(
        "/api/ledger/participations/unmatched-donations",
      );
      if (dRes.ok) {
        const data = await dRes.json();
        setUnmatchedDonations(data);
      } else if (dRes.status !== 401) {
        // Don't show error if already showed auth error above
        const error = await dRes
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Failed to load unmatched donations:", error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
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
              journalId: donation.journalId, // Send as string, backend will convert
            },
          }),
        },
      );

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || error.message || "Failed to match");
      }

      toast.success("Payment matched successfully!");
      setSelectedParticipation(null);
      setSelectedDonation(null);
      await loadData();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to match payment";
      toast.error(msg);
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
      // Note: REFUNDED participations are deleted after refund is sent
      // so this case won't occur in practice
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Participations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage cycle participations, payments, refunds, and payouts
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              Total Participants
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {participations.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4 text-amber-600" />
              Awaiting Payment
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-amber-600">
              {awaitingPayment.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need to be matched
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Ban className="h-4 w-4 text-red-600" />
              Refunds Needed
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-red-600">
              {needsRefund.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cancelled participations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Payouts Pending
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {needsPayout.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to pay out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* All Participants Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Participants
          </CardTitle>
          <CardDescription>
            Current participation status for all cycles ({participations.length}{" "}
            total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participations.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">
                No participations yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Participations will appear here once users opt in to cycles
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Character</th>
                      <th className="text-left p-3 font-medium">Cycle</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Payment</th>
                      <th className="text-left p-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {participations.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 font-medium">{p.characterName}</td>
                        <td className="p-3">
                          <div className="text-xs text-muted-foreground">
                            {p.cycle.name || p.cycleId.substring(0, 8)}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          {formatIsk(p.amountIsk)} ISK
                        </td>
                        <td className="p-3">{getStatusBadge(p.status)}</td>
                        <td className="p-3">
                          {p.walletJournalId ? (
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-600 text-xs"
                            >
                              Linked
                            </Badge>
                          ) : p.status === "AWAITING_INVESTMENT" ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 text-xs"
                            >
                              Pending
                            </Badge>
                          ) : p.status === "OPTED_OUT" && !p.refundedAt ? (
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-600 text-xs"
                            >
                              Needs Refund
                            </Badge>
                          ) : null}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Matching Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Manual Payment Matching
          </CardTitle>
          <CardDescription>
            Select a participation and a donation to manually link them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Participations Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Awaiting Payment</h3>
                <Badge variant="secondary" className="text-xs">
                  {awaitingPayment.length}
                </Badge>
              </div>
              <div className="rounded-lg border max-h-[400px] overflow-y-auto bg-muted/20">
                {awaitingPayment.length === 0 ? (
                  <div className="p-8 text-center">
                    <LinkIcon className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No participations awaiting payment
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {awaitingPayment.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedParticipation(p.id)}
                        className={`p-3 cursor-pointer transition-all ${
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
                        <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                          {p.memo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Donations Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Unmatched Donations</h3>
                <Badge variant="secondary" className="text-xs">
                  {unmatchedDonations.length}
                </Badge>
              </div>
              <div className="rounded-lg border max-h-[400px] overflow-y-auto bg-muted/20">
                {unmatchedDonations.length === 0 ? (
                  <div className="p-8 text-center">
                    <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No unmatched donations
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {unmatchedDonations.map((d, idx) => (
                      <div
                        key={`${d.characterId}-${d.journalId}-${idx}`}
                        onClick={() => setSelectedDonation(d.journalId)}
                        className={`p-3 cursor-pointer transition-all ${
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
                        <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
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

          <div className="mt-6 flex items-center justify-center">
            <Button
              onClick={handleManualMatch}
              disabled={!selectedParticipation || !selectedDonation || matching}
              size="lg"
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
            <Ban className="h-5 w-5 text-red-600" />
            Refunds Needed
          </CardTitle>
          <CardDescription>
            Participations that have been cancelled and need refunds (
            {needsRefund.length} pending)
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
              <div className="overflow-x-auto">
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
                      <tr
                        key={p.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 font-medium">{p.characterName}</td>
                        <td className="p-3 text-right font-mono text-red-600 font-semibold">
                          {formatIsk(p.amountIsk)} ISK
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {p.cycle.name || p.cycle.id}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(p.optedOutAt!).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={async () => {
                              const confirmed = window.confirm(
                                `Mark ${formatIsk(p.amountIsk)} ISK refund as sent to ${p.characterName}?`,
                              );
                              if (!confirmed) return;

                              try {
                                // Ensure amountIsk has exactly 2 decimal places for backend validation
                                const amount = parseFloat(p.amountIsk).toFixed(
                                  2,
                                );
                                const res = await fetch(
                                  `/api/ledger/participations/${p.id}/refund`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      amountIsk: amount,
                                    }),
                                  },
                                );
                                if (!res.ok) {
                                  const error = await res
                                    .json()
                                    .catch(() => ({ error: "Unknown error" }));
                                  throw new Error(
                                    error.error || error.message || "Failed",
                                  );
                                }
                                toast.success("Refund marked as sent!");
                                await loadData();
                              } catch (error) {
                                const msg =
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to mark refund";
                                toast.error(msg);
                              }
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Mark Refund Sent
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Payouts Needed
          </CardTitle>
          <CardDescription>
            Completed cycle participations awaiting payout ({needsPayout.length}{" "}
            pending)
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Character</th>
                      <th className="text-right p-3 font-medium">Investment</th>
                      <th className="text-right p-3 font-medium">Payout</th>
                      <th className="text-right p-3 font-medium">Return</th>
                      <th className="text-left p-3 font-medium">Cycle</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {needsPayout.map((p) => {
                      const investment = parseFloat(p.amountIsk);
                      const profitShare = parseFloat(p.payoutAmountIsk!);
                      // Total payout = investment + profit (so user gets their money back plus profit)
                      const totalPayout = investment + profitShare;
                      const returnPct = (profitShare / investment) * 100;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {p.characterName}
                              </span>
                              <button
                                onClick={() =>
                                  handleCopy(p.characterName, "character name")
                                }
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Copy character name"
                              >
                                {copiedText === "character name" ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {formatIsk(p.amountIsk)} ISK
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="font-mono font-semibold text-emerald-600">
                                {formatIsk(totalPayout.toString())} ISK
                              </div>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    totalPayout.toFixed(2),
                                    "payout amount",
                                  )
                                }
                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                title="Copy payout amount"
                              >
                                {copiedText === "payout amount" ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="text-emerald-600 font-semibold text-xs">
                              +{returnPct.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              +{formatIsk(profitShare.toString())}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {p.cycle.name || p.cycle.id}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  `Mark ${formatIsk(totalPayout.toString())} ISK payout as sent to ${p.characterName}?\n\nThis includes:\n- Investment: ${formatIsk(investment.toString())} ISK\n- Profit: ${formatIsk(profitShare.toString())} ISK`,
                                );
                                if (!confirmed) return;

                                try {
                                  const res = await fetch(
                                    `/api/ledger/participations/${p.id}/mark-payout-sent`,
                                    {
                                      method: "POST",
                                    },
                                  );
                                  if (!res.ok) {
                                    const error = await res
                                      .json()
                                      .catch(() => ({
                                        error: "Unknown error",
                                      }));
                                    throw new Error(
                                      error.error || error.message || "Failed",
                                    );
                                  }
                                  toast.success("Payout marked as sent!");
                                  await loadData();
                                } catch (error) {
                                  const msg =
                                    error instanceof Error
                                      ? error.message
                                      : "Failed to mark payout";
                                  toast.error(msg);
                                }
                              }}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              Mark Payout Sent
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
