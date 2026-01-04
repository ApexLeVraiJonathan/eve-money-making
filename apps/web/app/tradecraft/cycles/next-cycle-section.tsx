"use client";

import * as React from "react";
import { Copy, Lock, X, LogIn } from "lucide-react";
import { Badge } from "@eve/ui";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";
import { toast } from "sonner";
import OptInDialog from "./opt-in-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import {
  useMaxParticipation,
  useMyParticipation,
  useOptOutParticipation,
  useIncreaseParticipation,
  useMyJingleYieldStatus,
} from "../api";
import { startUserLogin, useCurrentUser } from "../api/characters/users.hooks";

type NextCycle = {
  id: string;
  name: string | null;
  startedAt: string;
  status: string;
};

export default function NextCycleSection({ next }: { next: NextCycle | null }) {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();

  // Use new API hook
  const { data: participation, isLoading: loading } = useMyParticipation(
    next?.id ?? "",
  );
  const optOutMutation = useOptOutParticipation();
  const increaseMutation = useIncreaseParticipation();
  const { data: maxParticipation } = useMaxParticipation();
  const { data: myJingleYieldStatus } = useMyJingleYieldStatus();

  const [increaseOpen, setIncreaseOpen] = React.useState(false);
  const [deltaInput, setDeltaInput] = React.useState("");
  const [deltaError, setDeltaError] = React.useState<string | null>(null);

  // Format number with commas for display
  const formatNumberWithCommas = (num: number): string => {
    return num.toLocaleString("en-US");
  };

  // Parse formatted input back to number
  const parseFormattedNumber = (str: string): number => {
    const cleaned = str.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  // Handle delta input change with formatting
  const handleDeltaChange = (value: string) => {
    const numValue = parseFormattedNumber(value);
    setDeltaInput(numValue > 0 ? formatNumberWithCommas(numValue) : "");
    setDeltaError(null);
  };

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
    } catch {
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

  const handleIncreaseSubmit = async () => {
    if (!participation || !next) return;

    // For FULL_PAYOUT rollovers, treat the "current amount" used for caps as the
    // previous-cycle principal plus any user-funded extra tracked on the
    // rollover participation (1 ISK baseline + extra). For other participations,
    // use the raw amount.
    const isRollover = participation.memo.startsWith("ROLLOVER-");
    const rolloverType = isRollover ? participation.memo.split("-")[3] : null;
    const basePrincipalForRollover =
      isRollover &&
      rolloverType === "FULL" &&
      participation.rolloverRequestedAmountIsk
        ? Number(participation.rolloverRequestedAmountIsk)
        : 0;
    const rolloverUserExtra =
      isRollover && rolloverType === "FULL"
        ? Math.max(Number(participation.amountIsk) - 1, 0)
        : 0;

    const currentAmount =
      isRollover && rolloverType === "FULL"
        ? basePrincipalForRollover + rolloverUserExtra
        : Number(participation.amountIsk);
    // Increasing a participation adds user-funded principal, so the relevant limit
    // is the effective principal cap (may be reduced by JingleYield).
    const maxIsk = maxParticipation
      ? Number(maxParticipation.effectivePrincipalCapIsk)
      : undefined;
    const remainingCap =
      maxIsk !== undefined ? Math.max(0, maxIsk - currentAmount) : undefined;

    if (remainingCap !== undefined && remainingCap <= 0) {
      const msg =
        "You have already reached your maximum allowed participation for this cycle.";
      setDeltaError(msg);
      toast.error(msg);
      return;
    }

    const cleaned = deltaInput.replace(/[,_\s]/g, "");
    const delta = Number(cleaned);

    if (!Number.isFinite(delta) || delta <= 0) {
      setDeltaError("Please enter a valid positive amount in ISK.");
      return;
    }

    const newTotal = currentAmount + delta;
    if (maxIsk !== undefined && newTotal > maxIsk) {
      const msg = `Increasing to ${formatIsk(
        newTotal,
      )} ISK would exceed your maximum allowed (${
        maxParticipation!.effectivePrincipalCapB
      }B ISK).`;
      setDeltaError(msg);
      toast.error(msg);
      return;
    }

    try {
      const res = await increaseMutation.mutateAsync({
        participationId: participation.id,
        deltaAmountIsk: delta.toFixed(2),
      });

      const prev = Number(res.previousAmountIsk);
      const added = Number(res.deltaAmountIsk);
      const updated = Number(res.newAmountIsk);

      toast.success(
        `Participation increased from ${formatIsk(
          prev,
        )} to ${formatIsk(updated)}. Please send an additional ${formatIsk(
          added,
        )} ISK to complete your participation.`,
      );

      setIncreaseOpen(false);
      // Simple approach: reload to reflect updated state
      window.location.reload();
    } catch (e) {
      setDeltaError(
        e instanceof Error ? e.message : "Failed to increase participation.",
      );
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
        (() => {
          // Parse rollover type from memo (format: ROLLOVER-cycleId-participationId-TYPE)
          const isRollover = participation.memo.startsWith("ROLLOVER-");
          const isJingleYieldRoot = participation.memo.startsWith("JY-");

          // For JY root participations, compute how much of the amount is admin
          // seeded vs user-funded extra, using the active JingleYield status.
          const jyLockedPrincipal =
            isJingleYieldRoot && myJingleYieldStatus
              ? Number(myJingleYieldStatus.lockedPrincipalIsk)
              : 0;
          const jyUserExtra = isJingleYieldRoot
            ? Math.max(Number(participation.amountIsk) - jyLockedPrincipal, 0)
            : 0;
          const rolloverType = isRollover
            ? participation.memo.split("-")[3]
            : null;

          // For FULL_PAYOUT rollovers we store the previous cycle principal in
          // rolloverRequestedAmountIsk and use amountIsk as:
          //   - 1.00 ISK baseline (no extra)
          //   - 1.00 + X ISK once the user has increased their participation.
          // Compute an effective current principal for display and cap hints.
          const basePrincipalForRollover =
            isRollover &&
            rolloverType === "FULL" &&
            participation.rolloverRequestedAmountIsk
              ? Number(participation.rolloverRequestedAmountIsk)
              : 0;
          const rolloverUserExtra =
            isRollover && rolloverType === "FULL"
              ? Math.max(Number(participation.amountIsk) - 1, 0)
              : 0;
          const effectiveCurrentPrincipal =
            isRollover && rolloverType === "FULL"
              ? basePrincipalForRollover + rolloverUserExtra
              : Number(participation.amountIsk);

          // Principal vs total: prefer explicit userPrincipalIsk when present.
          const principalIsk = (() => {
            const explicit = Number(participation.userPrincipalIsk);
            if (Number.isFinite(explicit)) return explicit;

            // Back-compat fallbacks
            if (isJingleYieldRoot) return jyUserExtra;
            if (isRollover && rolloverType === "FULL") return effectiveCurrentPrincipal;
            return Number(participation.amountIsk);
          })();

          const totalInvestedIsk = (() => {
            // For FULL rollovers, total is determined at cycle close. Show principal as the current baseline.
            if (isRollover && rolloverType === "FULL") return null;
            const n = Number(participation.amountIsk);
            return Number.isFinite(n) ? n : null;
          })();

          return (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      You&apos;re participating in this cycle
                    </span>
                    {isRollover &&
                    participation.status === "AWAITING_INVESTMENT" ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-600"
                      >
                        Auto-funded
                      </Badge>
                    ) : (
                      getStatusBadge(participation.status)
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">
                        Character:
                      </span>{" "}
                      {participation.characterName}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">
                        Amount:
                      </span>{" "}
                      {isRollover ? (
                        <div className="inline-flex flex-col gap-0.5">
                          <span>
                            {rolloverType === "FULL" ? (
                              <span className="text-amber-600">
                                Calculated at cycle close
                              </span>
                            ) : (
                              <>{formatIsk(participation.amountIsk)} ISK</>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Rollover:{" "}
                            {rolloverType === "FULL"
                              ? "Full Payout"
                              : rolloverType === "INITIAL"
                                ? "Initial Only"
                                : "Custom Amount"}
                          </span>
                        </div>
                      ) : (
                        <>{formatIsk(participation.amountIsk)} ISK</>
                      )}
                    </div>

                    {/* Cap breakdown */}
                    {maxParticipation ? (
                      <div className="mt-2 rounded-md bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground">
                          Principal (your money)
                        </div>
                        <div className="text-sm font-mono">
                          <span className="font-semibold text-foreground">
                            {formatIsk(principalIsk)} ISK
                          </span>{" "}
                          <span className="text-muted-foreground">/</span>{" "}
                          <span className="font-semibold">
                            {maxParticipation.effectivePrincipalCapB}B ISK
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Total invested (principal + reinvested interest)
                        </div>
                        <div className="text-sm font-mono">
                          {totalInvestedIsk == null ? (
                            <span className="text-amber-600">
                              Calculated at cycle close (FULL rollover)
                            </span>
                          ) : (
                            <>
                              <span className="font-semibold text-foreground">
                                {formatIsk(totalInvestedIsk)} ISK
                              </span>{" "}
                              <span className="text-muted-foreground">/</span>{" "}
                            </>
                          )}
                          <span className="font-semibold">
                            {maxParticipation.maximumCapB}B ISK
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          If your cycle result exceeds the maximum cap, excess
                          interest is paid out.
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <span className="font-medium text-foreground">
                        Submitted:
                      </span>{" "}
                      {new Date(participation.createdAt).toLocaleString()}
                    </div>
                    {participation.status === "AWAITING_INVESTMENT" &&
                      (isRollover ? (
                        rolloverType === "FULL" && rolloverUserExtra > 0 ? (
                          <div className="mt-2 rounded-md bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
                            <div className="font-medium mb-2 text-sm flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Rollover + extra: payment required
                            </div>
                            <p className="text-xs">
                              Your base participation for this cycle will be
                              auto-funded from your payout when the current
                              cycle closes. You have added{" "}
                              <span className="font-semibold">
                                {formatIsk(rolloverUserExtra)} ISK
                              </span>{" "}
                              on top of the rollover. Please send exactly this{" "}
                              extra amount with the memo below to complete your
                              participation.
                            </p>
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  To:{" "}
                                  <strong className="font-mono">
                                    LeVraiTrader
                                  </strong>
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs hover:bg-amber-500/20"
                                  onClick={() =>
                                    copyToClipboard(
                                      "LeVraiTrader",
                                      "Character name",
                                    )
                                  }
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm flex-shrink-0">
                                  Memo:
                                </span>
                                <code className="rounded bg-background px-2 py-1 font-mono text-xs max-w-md truncate">
                                  {participation.memo}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs hover:bg-amber-500/20 flex-shrink-0"
                                  onClick={() =>
                                    copyToClipboard(
                                      participation.memo ?? "",
                                      "Memo",
                                    )
                                  }
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 rounded-md bg-green-500/10 p-3 text-green-900 dark:text-green-100">
                            <div className="font-medium mb-2 text-sm flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              No payment needed!
                            </div>
                            <p className="text-xs">
                              Your participation will be automatically funded
                              from your payout when the current cycle closes.
                              The admin will handle everything for you.
                            </p>
                          </div>
                        )
                      ) : isJingleYieldRoot ? (
                        <div className="mt-2 rounded-md bg-green-500/10 p-3 text-green-900 dark:text-green-100">
                          <div className="font-medium mb-2 text-sm flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Admin-funded JingleYield principal
                          </div>
                          {jyUserExtra > 0 ? (
                            <>
                              <p className="text-xs">
                                The initial JingleYield principal for this
                                program is funded by the admin. You have added{" "}
                                <span className="font-semibold">
                                  {formatIsk(jyUserExtra)} ISK
                                </span>{" "}
                                on top of the seeded amount. Please send{" "}
                                <span className="font-semibold">
                                  {formatIsk(jyUserExtra)} ISK
                                </span>{" "}
                                with the memo below to complete your
                                participation.
                              </p>
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">
                                    To:{" "}
                                    <strong className="font-mono">
                                      LeVraiTrader
                                    </strong>
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs hover:bg-amber-500/20"
                                    onClick={() =>
                                      copyToClipboard(
                                        "LeVraiTrader",
                                        "Character name",
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm flex-shrink-0">
                                    Memo:
                                  </span>
                                  <code className="rounded bg-background px-2 py-1 font-mono text-xs max-w-md truncate">
                                    {participation.memo}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs hover:bg-amber-500/20 flex-shrink-0"
                                    onClick={() =>
                                      copyToClipboard(
                                        participation.memo ?? "",
                                        "Memo",
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs">
                              The initial JingleYield principal for this program
                              is funded by the admin. You do not need to send
                              ISK for that seeded amount. If you choose to
                              increase your participation later, only the extra
                              ISK you add needs to be paid.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-md bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
                          <div className="font-medium mb-3 text-sm">
                            ⚠️ Don&apos;t forget to send{" "}
                            {formatIsk(participation.amountIsk)} ISK to complete
                            your participation
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                To:{" "}
                                <strong className="font-mono">
                                  LeVraiTrader
                                </strong>
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs hover:bg-amber-500/20"
                                onClick={() =>
                                  copyToClipboard(
                                    "LeVraiTrader",
                                    "Character name",
                                  )
                                }
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm flex-shrink-0">
                                Memo:
                              </span>
                              <code className="rounded bg-background px-2 py-1 font-mono text-xs max-w-md truncate">
                                {participation.memo}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs hover:bg-amber-500/20 flex-shrink-0"
                                onClick={() =>
                                  copyToClipboard(
                                    participation.memo ?? "",
                                    "Memo",
                                  )
                                }
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    {participation.status === "OPTED_IN" && (
                      <div className="mt-2 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-900 dark:text-emerald-100">
                        ✓ Your investment has been confirmed and will be
                        included in the cycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Increase / Opt-out actions (PLANNED cycles only) */}
              {(participation.status === "AWAITING_INVESTMENT" ||
                participation.status === "OPTED_IN") &&
                next.status.toUpperCase() === "PLANNED" && (
                  <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeltaInput("");
                        setDeltaError(null);
                        setIncreaseOpen(true);
                      }}
                      disabled={increaseMutation.isPending}
                      className="gap-2"
                    >
                      <>Increase Participation</>
                    </Button>
                    {!isJingleYieldRoot && (
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
                    )}
                    {participation.status === "OPTED_IN" &&
                      !isJingleYieldRoot && (
                        <p className="mt-2 text-xs text-muted-foreground w-full">
                          You will be marked for refund if you cancel. An admin
                          will process your refund in-game.
                        </p>
                      )}

                    {/* Increase Participation dialog */}
                    <Dialog open={increaseOpen} onOpenChange={setIncreaseOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Increase Participation</DialogTitle>
                          <DialogDescription>
                            Adjust your participation amount for this planned
                            cycle. You can only add more ISK, not reduce it.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 mt-2">
                          <div className="text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Current amount:
                              </span>{" "}
                              <span className="font-mono font-semibold">
                                {formatIsk(effectiveCurrentPrincipal)} ISK
                              </span>
                            </div>
                            {maxParticipation && (
                              <div className="mt-1">
                                <span className="text-muted-foreground">
                                  Principal cap:
                                </span>{" "}
                                <span className="font-mono font-semibold">
                                  {maxParticipation.effectivePrincipalCapB}B ISK
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  • max cap{" "}
                                </span>
                                <span className="font-mono font-semibold">
                                  {maxParticipation.maximumCapB}B ISK
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="increase-delta">
                              Additional amount (ISK)
                            </Label>
                            <Input
                              id="increase-delta"
                              type="text"
                              placeholder="500,000,000"
                              value={deltaInput}
                              onChange={(e) =>
                                handleDeltaChange(e.target.value)
                              }
                              className="font-mono"
                            />
                            {deltaInput && (
                              <p className="text-xs text-muted-foreground">
                                New total (approx):{" "}
                                <span className="font-mono font-semibold">
                                  {(() => {
                                    const cleaned = deltaInput.replace(
                                      /[,_\s]/g,
                                      "",
                                    );
                                    const delta = Number(cleaned);
                                    if (!Number.isFinite(delta) || delta <= 0) {
                                      return "---";
                                    }
                                    // Mirror the cap logic: for FULL_PAYOUT rollovers,
                                    // preview principal as previous-cycle principal +
                                    // existing extra + new delta; otherwise, just
                                    // amountIsk + delta.
                                    const isRolloverPreview =
                                      participation.memo.startsWith(
                                        "ROLLOVER-",
                                      );
                                    const rolloverTypePreview =
                                      isRolloverPreview
                                        ? participation.memo.split("-")[3]
                                        : null;
                                    const basePrincipalPreview =
                                      isRolloverPreview &&
                                      rolloverTypePreview === "FULL" &&
                                      participation.rolloverRequestedAmountIsk
                                        ? Number(
                                            participation.rolloverRequestedAmountIsk,
                                          )
                                        : 0;
                                    const rolloverUserExtraPreview =
                                      isRolloverPreview &&
                                      rolloverTypePreview === "FULL"
                                        ? Math.max(
                                            Number(participation.amountIsk) - 1,
                                            0,
                                          )
                                        : 0;
                                    const effectiveCurrent =
                                      isRolloverPreview &&
                                      rolloverTypePreview === "FULL"
                                        ? basePrincipalPreview +
                                          rolloverUserExtraPreview
                                        : Number(participation.amountIsk);

                                    return `${formatIsk(
                                      effectiveCurrent + delta,
                                    )} ISK`;
                                  })()}
                                </span>
                              </p>
                            )}
                            {deltaError && (
                              <p className="text-xs text-red-500">
                                {deltaError}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIncreaseOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleIncreaseSubmit}
                            disabled={increaseMutation.isPending}
                            className="gap-2"
                          >
                            {increaseMutation.isPending
                              ? "Updating..."
                              : "Confirm Increase"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
            </div>
          );
        })()
      ) : !userLoading && !currentUser ? (
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
                onClick={() => {
                  const returnUrl =
                    typeof window !== "undefined" ? window.location.href : "/";
                  startUserLogin(returnUrl);
                }}
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
