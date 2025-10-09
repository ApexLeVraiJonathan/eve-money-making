import Link from "next/link";
import { CircleDollarSign, Recycle, PieChart } from "lucide-react";

export default function ArbitrageHome() {
  return (
    <div className="p-6 space-y-8">
      {/* Hero */}
      <section className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <CircleDollarSign className="h-6 w-6" />
          </span>
          Arbitrage
        </h1>
        <p className="mt-2 max-w-3xl">
          Track invested capital and profit share across arbitrage cycles.
          Opt-in with ISK, follow progress during the cycle, and receive a
          payout at the end.
        </p>
        <div className="mt-4 flex gap-3 text-sm items-center">
          <Link
            href="/arbitrage/cycles/opt-in"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Opt-in to next cycle
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/arbitrage/cycles"
            className="underline underline-offset-4"
          >
            View current cycle
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/arbitrage/reports"
            className="underline underline-offset-4"
          >
            View reports
          </Link>
        </div>
      </section>

      {/* Three-up intro */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">What you can do</h2>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
            <li>Opt-in to cycles with an ISK amount</li>
            <li>Track cycle progress and your estimated payout</li>
            <li>Review your past performance and payouts</li>
          </ul>
        </div>
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">How it works</h2>
          <ol className="list-decimal pl-6 mt-2 space-y-1 text-sm">
            <li>Opt-in for the next cycle with your investment amount</li>
            <li>Send ISK to the designated character with the provided memo</li>
            <li>Follow progress; receive payout after the cycle ends</li>
          </ol>
        </div>
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">Project plan</h2>
          <p className="text-sm mt-2">
            Public Arbitrage provides limited visibility into cycle performance
            and investor payouts, with anonymity preserved.
          </p>
          <div className="mt-2 flex items-center gap-2 text-muted-foreground">
            <Recycle className="h-4 w-4" />
            <span className="text-xs">
              Cycles: commits, cash/inventory, returns
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <PieChart className="h-4 w-4" />
            <span className="text-xs">
              Reports: payouts, returns, participation
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
