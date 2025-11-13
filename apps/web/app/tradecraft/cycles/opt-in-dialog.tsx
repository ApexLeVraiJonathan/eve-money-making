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
import { ClipboardCopy, Coins, User, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@eve/ui";
import { useCycles, useCreateParticipation, useCurrentUser } from "../api";

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

  // Preset amounts
  const presetAmounts = [
    { label: "100M", value: 100_000_000 },
    { label: "500M", value: 500_000_000 },
    { label: "1B", value: 1_000_000_000 },
    { label: "5B", value: 5_000_000_000 },
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

      const participation = await createParticipation.mutateAsync({
        cycleId: next.id,
        data: {
          characterName: character,
          amountIsk: amt.toFixed(2),
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
                </Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="optin-amount"
                      type="text"
                      placeholder="0"
                      aria-describedby="optin-amount-hint"
                      value={amountInput}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="pr-16 text-lg font-mono"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground">
                      ISK
                    </div>
                  </div>
                  <div
                    id="optin-amount-hint"
                    className="text-sm font-medium text-primary"
                  >
                    {formatIsk(amount)}
                  </div>
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
                  disabled={submitting || amount <= 0}
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
                  <div className="text-xl font-bold text-primary">
                    {formatIsk(amount)}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
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
                          await navigator.clipboard.writeText("LeVraiTrader");
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
                          <strong className="text-foreground">Reason</strong>{" "}
                          field
                        </span>
                      </li>
                    </ol>
                    <p className="text-xs text-amber-700 dark:text-amber-300/80 font-medium">
                      ⚠️ Don&apos;t use the Wallet - it won&apos;t let you add a
                      reason!
                    </p>
                  </div>
                </div>
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
