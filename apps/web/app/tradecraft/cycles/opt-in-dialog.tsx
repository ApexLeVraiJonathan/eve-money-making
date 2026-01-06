"use client";
import * as React from "react";
import { formatIsk } from "@/lib/utils";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import {
  ClipboardCopy,
  Coins,
  User,
  ArrowRight,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "@eve/ui";
import { Badge } from "@eve/ui";
import { RadioGroup, RadioGroupItem } from "@eve/ui";
import { Checkbox } from "@eve/ui";
import {
  useCycles,
  useCreateParticipation,
  useCurrentUser,
  useMaxParticipation,
  useMyParticipation,
} from "../api";

type OptInDialogProps = {
  nextCycleName: string;
  triggerLabel?: string;
  triggerClassName?: string;
  onSuccess?: () => void;
};

export default function OptInDialog(props: OptInDialogProps) {
  const {
    nextCycleName,
    triggerLabel = "Opt-in now",
    triggerClassName,
    onSuccess,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"form" | "confirm">("form");

  const [amount, setAmount] = React.useState<number>(1000000000);
  const [amountInput, setAmountInput] = React.useState<string>("1,000,000,000");
  const [character, setCharacter] = React.useState<string>("YourName");
  const [submitting, setSubmitting] = React.useState(false);
  const [memo, setMemo] = React.useState<string>("");
  const [participationCreated, setParticipationCreated] = React.useState(false);

  // Rollover state
  const [useRollover, setUseRollover] = React.useState(false);
  const [rolloverType, setRolloverType] = React.useState<
    "FULL_PAYOUT" | "INITIAL_ONLY" | "CUSTOM_AMOUNT"
  >("FULL_PAYOUT");
  const [customRolloverAmount, setCustomRolloverAmount] =
    React.useState<number>(0);

  // Format number with commas for display
  const formatNumberWithCommas = (num: number): string => {
    return num.toLocaleString("en-US");
  };

  // Parse formatted input back to number
  const parseFormattedNumber = (str: string): number => {
    const cleaned = str.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  // Handle amount input change
  const handleAmountChange = (value: string) => {
    const numValue = parseFormattedNumber(value);
    setAmount(numValue);
    setAmountInput(numValue > 0 ? formatNumberWithCommas(numValue) : "");
  };

  // Preset amounts (updated to match new caps: 10B, 5B, 3B, 1B, 500M)
  const presetAmounts = [
    { label: "500M", value: 500_000_000 },
    { label: "1B", value: 1_000_000_000 },
    { label: "3B", value: 3_000_000_000 },
    { label: "5B", value: 5_000_000_000 },
    { label: "10B", value: 10_000_000_000 },
  ];

  // Auto-load character name when dialog opens
  const { data: me } = useCurrentUser();

  React.useEffect(() => {
    if (open && me?.characterName) {
      setCharacter(me.characterName);
    }
  }, [open, me]);

  const { data: cycles } = useCycles();
  const createParticipation = useCreateParticipation();
  const { data: maxParticipation } = useMaxParticipation();

  // Find current OPEN cycle for rollover eligibility check
  const openCycle = (cycles ?? []).find((c) => c.status === "OPEN");
  const { data: currentParticipation } = useMyParticipation(
    openCycle?.id ?? "",
  );

  // Determine if user is eligible for rollover
  const isRolloverEligible =
    !!openCycle &&
    !!currentParticipation &&
    ["OPTED_IN", "AWAITING_PAYOUT"].includes(currentParticipation.status);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amt = Math.max(0, amount);

      // Find next planned cycle
      const next = (cycles ?? [])
        .filter((c) => c.status === "PLANNED")
        .sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        )[0];

      if (!next) throw new Error("No planned cycle available");

      // Validate amount against principal + maximum caps (amount is user principal for non-rollover opt-ins)
      if (!useRollover && maxParticipation) {
        if (amt > Number(maxParticipation.effectivePrincipalCapIsk)) {
          throw new Error(
            `Participation principal exceeds maximum allowed (${maxParticipation.effectivePrincipalCapB}B ISK)`,
          );
        }
        if (amt > Number(maxParticipation.maximumCapIsk)) {
          throw new Error(
            `Participation exceeds maximum allowed (${maxParticipation.maximumCapB}B ISK)`,
          );
        }
      }

      // Build rollover payload if applicable
      const rolloverPayload =
        useRollover && isRolloverEligible
          ? {
              type: rolloverType,
              ...(rolloverType === "CUSTOM_AMOUNT" && {
                customAmountIsk: customRolloverAmount.toFixed(2),
              }),
            }
          : undefined;

      const participation = await createParticipation.mutateAsync({
        cycleId: next.id,
        data: {
          characterName: character,
          amountIsk: amt.toFixed(2),
          rollover: rolloverPayload,
        },
      });

      setMemo(participation.memo ?? `ARB ${next.id} ${character}`);
      setParticipationCreated(true);
      setStep("confirm");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to form when dialog closes and call onSuccess if participation was created
  React.useEffect(() => {
    if (!open) {
      // Small delay to ensure dialog is fully closed before triggering refresh
      const timer = setTimeout(() => {
        // If participation was successfully created, notify parent
        if (participationCreated) {
          onSuccess?.();
          setParticipationCreated(false);
        }
      }, 100);

      // Reset state
      setStep("form");
      setMemo("");

      return () => clearTimeout(timer);
    }
  }, [open, participationCreated, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Coins className="h-4 w-4" />
                </span>
                Opt-in to the next cycle
              </DialogTitle>
              <DialogDescription>
                Next cycle:{" "}
                <Badge variant="secondary" className="font-mono">
                  {nextCycleName}
                </Badge>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Investment Amount */}
              <div className="space-y-3">
                <Label htmlFor="optin-amount" className="text-base font-medium">
                  Investment Amount
                  {useRollover && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (auto-filled from rollover)
                    </span>
                  )}
                </Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="optin-amount"
                      type="text"
                      placeholder="0"
                      aria-describedby="optin-amount-hint"
                      value={
                        useRollover
                          ? rolloverType === "CUSTOM_AMOUNT"
                            ? formatNumberWithCommas(customRolloverAmount)
                            : rolloverType === "INITIAL_ONLY"
                              ? formatNumberWithCommas(
                                  Number(currentParticipation!.amountIsk),
                                )
                              : "Auto-calculated"
                          : amountInput
                      }
                      onChange={(e) => handleAmountChange(e.target.value)}
                      disabled={useRollover}
                      className={`pr-16 text-lg font-mono ${
                        useRollover
                          ? "bg-muted cursor-not-allowed opacity-75"
                          : ""
                      } ${
                        !useRollover &&
                        maxParticipation &&
                        amount >
                          Number(maxParticipation.effectivePrincipalCapIsk)
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground">
                      ISK
                    </div>
                  </div>
                  {!useRollover && (
                    <div
                      id="optin-amount-hint"
                      className="text-sm font-medium text-primary"
                    >
                      {formatIsk(amount)}
                    </div>
                  )}
                  {!useRollover &&
                    maxParticipation &&
                    amount >
                      Number(maxParticipation.effectivePrincipalCapIsk) && (
                      <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5 flex-shrink-0"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <strong>Amount exceeds maximum allowed</strong>
                          <br />
                          Principal cap for your account is{" "}
                          <strong>
                            {maxParticipation.effectivePrincipalCapB}B ISK
                          </strong>
                          . Please reduce the amount.
                        </div>
                      </div>
                    )}
                  <div className="flex flex-wrap gap-2">
                    {presetAmounts.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAmount(preset.value);
                          setAmountInput(formatNumberWithCommas(preset.value));
                        }}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Max Participation Cap Info */}
              {maxParticipation && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Principal cap:{" "}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {maxParticipation.effectivePrincipalCapB}B ISK
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Maximum cap: </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {maxParticipation.maximumCapB}B ISK
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Principal cap limits how much of{" "}
                    <span className="text-foreground">your own money</span> you
                    can add over time. Maximum cap limits how much can stay
                    invested; excess interest is paid out.
                  </div>
                </div>
              )}

              {/* Rollover Options */}
              {isRolloverEligible && (
                <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                          Automatic Reinvestment Available
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          You have an active participation of{" "}
                          <strong>
                            {formatIsk(Number(currentParticipation!.amountIsk))}
                          </strong>{" "}
                          in the current cycle
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="use-rollover"
                          checked={useRollover}
                          onCheckedChange={(checked) => {
                            const enabled = !!checked;
                            setUseRollover(enabled);
                            if (enabled) {
                              setRolloverType("INITIAL_ONLY");
                            }
                          }}
                        />
                        <Label
                          htmlFor="use-rollover"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Enable automatic reinvestment
                        </Label>
                      </div>

                      {useRollover && (
                        <RadioGroup
                          value={rolloverType}
                          onValueChange={(value) =>
                            setRolloverType(
                              value as
                                | "FULL_PAYOUT"
                                | "INITIAL_ONLY"
                                | "CUSTOM_AMOUNT",
                            )
                          }
                          className="space-y-3"
                        >
                          <div className="flex gap-3">
                            <RadioGroupItem
                              value="FULL_PAYOUT"
                              id="full"
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor="full"
                                className="cursor-pointer font-medium text-sm block"
                              >
                                Full Payout (Initial + Profit)
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Roll over your entire payout, capped at 20B ISK
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <RadioGroupItem
                              value="INITIAL_ONLY"
                              id="initial"
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor="initial"
                                className="cursor-pointer font-medium text-sm block"
                              >
                                Initial Investment Only
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Roll over only your initial{" "}
                                {formatIsk(
                                  Number(currentParticipation!.amountIsk),
                                )}
                                , receive profit as payout
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <RadioGroupItem
                              value="CUSTOM_AMOUNT"
                              id="custom"
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor="custom"
                                className="cursor-pointer font-medium text-sm block"
                              >
                                Custom Amount
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Specify amount ≤ your initial investment
                              </p>
                            </div>
                          </div>

                          {rolloverType === "CUSTOM_AMOUNT" && (
                            <div className="pl-8 pt-1 space-y-2">
                              <Input
                                type="text"
                                placeholder="Enter custom amount"
                                value={
                                  customRolloverAmount > 0
                                    ? formatNumberWithCommas(
                                        customRolloverAmount,
                                      )
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = parseFormattedNumber(
                                    e.target.value,
                                  );
                                  setCustomRolloverAmount(val);
                                }}
                                className={`font-mono ${
                                  customRolloverAmount >
                                  Number(currentParticipation!.amountIsk)
                                    ? "border-red-500 focus-visible:ring-red-500"
                                    : ""
                                }`}
                              />
                              {customRolloverAmount >
                                Number(currentParticipation!.amountIsk) && (
                                <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 p-2 text-xs text-red-600 dark:text-red-400">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-4 w-4 flex-shrink-0 mt-0.5"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <div>
                                    <strong>
                                      Amount exceeds initial investment
                                    </strong>
                                    <br />
                                    Maximum custom rollover is{" "}
                                    <strong>
                                      {formatIsk(
                                        Number(currentParticipation!.amountIsk),
                                      )}
                                    </strong>
                                    . Please reduce the amount.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Character Info */}
              <div className="space-y-2">
                <Label className="text-base font-medium">
                  Sending Character
                </Label>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{character}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    amount <= 0 ||
                    (!useRollover &&
                      maxParticipation &&
                      amount >
                        Number(maxParticipation.effectivePrincipalCapIsk)) ||
                    (useRollover &&
                      rolloverType === "CUSTOM_AMOUNT" &&
                      customRolloverAmount >
                        Number(currentParticipation!.amountIsk))
                  }
                  className="gap-2"
                >
                  {submitting ? (
                    "Processing..."
                  ) : (
                    <>
                      Generate Memo <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/15 text-green-600">
                  <Check className="h-4 w-4" />
                </span>
                Participation Created
              </DialogTitle>
              <DialogDescription>
                Follow these steps to complete your opt-in
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Investment Summary */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Investment Amount
                  </div>
                  {useRollover ? (
                    <div className="space-y-2">
                      {rolloverType === "FULL_PAYOUT" ? (
                        <>
                          <div className="text-xl font-bold text-amber-600">
                            Calculated at cycle close
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Your full payout will be automatically reinvested
                            (max 20B)
                          </div>
                        </>
                      ) : rolloverType === "INITIAL_ONLY" ? (
                        <>
                          <div className="text-xl font-bold text-amber-600">
                            {formatIsk(Number(currentParticipation!.amountIsk))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Only your initial investment will be rolled over
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-bold text-amber-600">
                            {formatIsk(customRolloverAmount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Custom amount will be rolled over from your payout
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-xl font-bold text-primary">
                      {formatIsk(amount)}
                    </div>
                  )}
                  {useRollover && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <RefreshCw className="h-4 w-4" />
                        <span className="font-medium">
                          Automatic Reinvestment Enabled
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                {useRollover ? (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 mb-2">
                      <Check className="h-4 w-4" />
                      <span className="font-semibold">No payment needed!</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your participation will be automatically funded from your
                      payout when the current cycle closes. The admin will
                      handle everything for you.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">
                        1
                      </Badge>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium">
                          Send ISK to the following character
                        </p>
                        <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                          <code className="flex-1 text-sm font-mono">
                            LeVraiTrader
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await navigator.clipboard.writeText(
                                "LeVraiTrader",
                              );
                              toast.success("Recipient copied to clipboard");
                            }}
                            className="h-8 gap-1.5"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">
                        2
                      </Badge>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium">
                          Use this exact reason for donation
                        </p>
                        <div className="flex items-center gap-2 rounded-md border bg-background p-2">
                          <code className="flex-1 text-sm font-mono break-all">
                            {memo}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await navigator.clipboard.writeText(memo);
                              toast.success("Memo copied to clipboard");
                            }}
                            className="h-8 gap-1.5"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* How to Send ISK */}
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="h-4 w-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            Important: How to Send ISK with Memo
                          </p>
                          <ol className="space-y-1.5 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="shrink-0 font-medium">1.</span>
                              <span>
                                Use the{" "}
                                <strong className="text-foreground">
                                  &quot;Search for anything&quot;
                                </strong>{" "}
                                bar at the top left of your EVE client
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="shrink-0 font-medium">2.</span>
                              <span>
                                Search for{" "}
                                <code className="rounded bg-background px-1 py-0.5 text-xs font-mono">
                                  LeVraiTrader
                                </code>{" "}
                                and open the character&apos;s profile
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="shrink-0 font-medium">3.</span>
                              <span>
                                Right-click the character and select{" "}
                                <strong className="text-foreground">
                                  &quot;Give Money&quot;
                                </strong>
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="shrink-0 font-medium">4.</span>
                              <span>
                                Paste the donation reason (memo) in the{" "}
                                <strong className="text-foreground">
                                  Reason
                                </strong>{" "}
                                field
                              </span>
                            </li>
                          </ol>
                          <p className="text-xs text-amber-700 dark:text-amber-300/80 font-medium">
                            ⚠️ Don&apos;t use the Wallet - it won&apos;t let you
                            add a reason!
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Status Flow */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Participation Status Flow
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">
                    Awaiting Investment
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Awaiting Validation
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Opted-In</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Completed</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep("form")}>
                  Back
                </Button>
                <Button onClick={() => setOpen(false)} className="gap-2">
                  Done <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
