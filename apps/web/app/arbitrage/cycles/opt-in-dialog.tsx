"use client";
import * as React from "react";
import { formatISK } from "../../brokerage/_mock/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

type OptInDialogProps = {
  nextCycleName: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

export default function OptInDialog(props: OptInDialogProps) {
  const {
    nextCycleName,
    triggerLabel = "Opt-in now",
    triggerClassName,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"form" | "confirm">("form");

  const [amount, setAmount] = React.useState<string>("1000000000");
  const [character, setCharacter] = React.useState<string>("YourName");
  const [submitting, setSubmitting] = React.useState(false);
  const [memo, setMemo] = React.useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amt = Math.max(0, Number(amount || 0));
      // Resolve next planned cycle from backend
      const cyclesRes = await fetch(`/api/ledger/cycles`, {
        cache: "no-store",
      });
      const cycles = (await cyclesRes.json()) as Array<{
        id: string;
        name?: string | null;
        startedAt: string;
        closedAt?: string | null;
      }>;
      if (!cyclesRes.ok) throw new Error("Failed to load cycles");
      const now = Date.now();
      const next = cycles
        .filter((c) => new Date(c.startedAt).getTime() > now)
        .sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        )[0];
      if (!next) throw new Error("No planned cycle available");

      const res = await fetch(`/api/ledger/cycles/${next.id}/participations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterName: character,
          amountIsk: String(amt.toFixed(2)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setMemo(String(data.memo ?? `ARB ${next.id} ${character}`));
      setStep("confirm");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep("form");
      setMemo("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Opt-in to the next cycle</DialogTitle>
              <DialogDescription>
                Next cycle:{" "}
                <span className="text-foreground">{nextCycleName}</span>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="optin-amount">Amount (ISK)</Label>
                <Input
                  id="optin-amount"
                  type="number"
                  aria-describedby="optin-amount-hint"
                  value={amount}
                  min={0}
                  step={1000000}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div
                  id="optin-amount-hint"
                  className="text-xs text-muted-foreground"
                >
                  {formatISK(Number(amount || 0))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="optin-character">Character (sender)</Label>
                <Input
                  id="optin-character"
                  type="text"
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  placeholder="Your EVE character name"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Generate memo"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm your opt-in</DialogTitle>
              <DialogDescription>
                Follow these steps to ensure your contribution is tracked.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="surface-2 rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Recipient</div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    LeVraiTrader
                  </code>
                  <Button
                    aria-label="Copy recipient"
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText("LeVraiTrader");
                      toast.success("Recipient copied");
                    }}
                  >
                    <ClipboardCopy />
                  </Button>
                </div>
              </div>
              <div className="surface-2 rounded-md border p-3">
                <div className="text-xs text-muted-foreground">
                  Donation reason
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {memo}
                  </code>
                  <Button
                    aria-label="Copy memo"
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(memo);
                      toast.success("Memo copied");
                    }}
                  >
                    <ClipboardCopy />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Statuses: Awaiting Investment → Awaiting Validation → Opted-In →
                Completed
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep("form")}>
                  Back
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
