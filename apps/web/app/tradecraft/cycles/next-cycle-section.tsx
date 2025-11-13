"use client";

import * as React from "react";
import { Copy, Lock, X, LogIn } from "lucide-react";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { toast } from "sonner";
import { useSession, signIn } from "next-auth/react";
import OptInDialog from "./opt-in-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import { useMyParticipation, useOptOutParticipation } from "../api";

type Participation = {
  id: string;
  cycleId: string;
  characterName: string;
  amountIsk: string;
  memo: string;
  status: string;
  walletJournalId: string | null;
  createdAt: string;
  validatedAt: string | null;
  optedOutAt: string | null;
};

type NextCycle = {
  id: string;
  name: string | null;
  startedAt: string;
  status: string;
};

export default function NextCycleSection({ next }: { next: NextCycle | null }) {
  const { status } = useSession();

  // Use new API hook
  const { data: participation, isLoading: loading } = useMyParticipation(
    next?.id ?? "",
  );
  const optOutMutation = useOptOutParticipation();

  const handleOptOut = async () => {
    if (!participation) return;

    const confirmed = window.confirm(
      participation.status === "AWAITING_INVESTMENT"
        ? "Are you sure you want to cancel your participation? You haven't sent payment yet, so no refund is needed."
        : "Are you sure you want to cancel your participation? You will need to wait for a refund of your investment.",
    );

    if (!confirmed) return;

    try {
      await optOutMutation.mutateAsync(participation.id);
      const wasAwaitingInvestment =
        participation.status === "AWAITING_INVESTMENT";
      toast.success(
        wasAwaitingInvestment
          ? "Participation cancelled successfully"
          : "Participation cancelled. A refund will be processed by an admin.",
      );
    } catch (error) {
      toast.error("Failed to cancel participation. Please try again.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AWAITING_INVESTMENT":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
            Awaiting Investment
          </Badge>
        );
      case "CONFIRMED":
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
            Opted Out
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatIsk = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (!next) {
    return (
      <Empty className="mt-3">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No planned cycle</EmptyTitle>
          <EmptyDescription>
            Planning isn&apos;t open yet. When the next cycle is announced, you
            can opt in here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="mt-2 text-sm">
        <div>
          <span className="text-muted-foreground">Name:</span>{" "}
          <span className="text-foreground">{next.name ?? next.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Starts:</span>{" "}
          {new Date(next.startedAt).toLocaleString()} •
          <span className="ml-1 text-muted-foreground">Status:</span>{" "}
          <span className="text-foreground">{next.status}</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Checking your participation…
        </div>
      ) : participation ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  You&apos;re participating in this cycle
                </span>
                {getStatusBadge(participation.status)}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">
                    Character:
                  </span>{" "}
                  {participation.characterName}
                </div>
                <div>
                  <span className="font-medium text-foreground">Amount:</span>{" "}
                  {formatIsk(participation.amountIsk)} ISK
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    Submitted:
                  </span>{" "}
                  {new Date(participation.createdAt).toLocaleString()}
                </div>
                {participation.status === "AWAITING_INVESTMENT" && (
                  <div className="mt-2 rounded-md bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
                    <div className="font-medium mb-3 text-sm">
                      ⚠️ Don&apos;t forget to send{" "}
                      {formatIsk(participation.amountIsk)} ISK to complete your
                      participation
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          To:{" "}
                          <strong className="font-mono">LeVraiTrader</strong>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs hover:bg-amber-500/20"
                          onClick={() =>
                            copyToClipboard("LeVraiTrader", "Character name")
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm flex-shrink-0">Memo:</span>
                        <code className="rounded bg-background px-2 py-1 font-mono text-xs max-w-md truncate">
                          {participation.memo}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs hover:bg-amber-500/20 flex-shrink-0"
                          onClick={() =>
                            copyToClipboard(participation.memo ?? "", "Memo")
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {participation.status === "OPTED_IN" && (
                  <div className="mt-2 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-900 dark:text-emerald-100">
                    ✓ Your investment has been confirmed and will be included in
                    the cycle.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Opt-out button */}
          {(participation.status === "AWAITING_INVESTMENT" ||
            participation.status === "OPTED_IN") && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOptOut}
                disabled={optOutMutation.isPending}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              >
                {optOutMutation.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Cancel Participation
                  </>
                )}
              </Button>
              {participation.status === "OPTED_IN" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  You will be marked for refund. An admin will process your
                  refund in-game.
                </p>
              )}
            </div>
          )}
        </div>
      ) : status === "unauthenticated" ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <LogIn className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">
                Sign in to participate in this cycle
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Connect your EVE Online character to opt-in and invest ISK in
                upcoming tradecraft cycles.
              </p>
              <Button
                onClick={() =>
                  void signIn("eveonline", {
                    callbackUrl:
                      typeof window !== "undefined"
                        ? window.location.href
                        : "/",
                  })
                }
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Sign in with EVE Online
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <OptInDialog
            nextCycleName={next.name ?? "Next cycle"}
            triggerClassName="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
            onSuccess={() => {
              // Refresh participation status
              window.location.reload();
            }}
          />
        </div>
      )}
    </>
  );
}
