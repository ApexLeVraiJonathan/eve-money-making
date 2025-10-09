"use client";
import * as React from "react";
import { submitOptIn, getNextCycle } from "../../_mock/store";
import { formatISK } from "../../../brokerage/_mock/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

export default function OptInPage() {
  const [amount, setAmount] = React.useState<string>("1000000000");
  const [character, setCharacter] = React.useState<string>("YourName");
  const [submitting, setSubmitting] = React.useState(false);
  const [nextName, setNextName] = React.useState<string>("");
  const [memo, setMemo] = React.useState<string>("");
  const [openConfirm, setOpenConfirm] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const n = await getNextCycle();
      setNextName(n.name);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amt = Math.max(0, Number(amount || 0));
      const res = await submitOptIn(amt, character);
      setMemo(res.memo);
      setOpenConfirm(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Opt-in</h1>
      <p className="text-sm text-muted-foreground">
        Opt-in to the next cycle ({nextName}). You will receive a unique memo to
        include with an ISK donation to ensure your contribution is tracked.
      </p>

      <form
        onSubmit={onSubmit}
        className="rounded-lg border p-4 space-y-4 max-w-md surface-1"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Amount (ISK)</label>
          <input
            type="number"
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={amount}
            min={0}
            step={1000000}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            {formatISK(Number(amount || 0))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Character (sender)</label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
            placeholder="Your EVE character name"
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
        >
          {submitting ? "Submitting…" : "Generate memo"}
        </Button>
      </form>

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
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
            <div className="flex justify-end">
              <Button onClick={() => setOpenConfirm(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
