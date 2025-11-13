import Link from "next/link";
import {
  CircleDollarSign,
  TrendingUp,
  Shield,
  Clock,
  BarChart3,
  AlertCircle,
} from "lucide-react";

export default function ArbitrageHome() {
  return (
    <div className="p-6 space-y-8">
      {/* Hero */}
      <section className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <CircleDollarSign className="h-6 w-6" />
          </span>
          Tradecraft
        </h1>
        <p className="mt-2 max-w-3xl text-base">
          Earn passive income in EVE Online by investing in professional market
          trading operations. Contribute ISK to a cycle, and we handle the
          trading—buying and selling across markets to generate profit. At the
          end of each cycle, receive your principal plus a share of the profits.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm items-center">
          <Link
            href="/tradecraft/cycles/opt-in"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Opt-in to next cycle
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/tradecraft/cycles"
            className="underline underline-offset-4"
          >
            View current cycle
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/tradecraft/reports"
            className="underline underline-offset-4"
          >
            View reports
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <span className="text-sm font-semibold">1</span>
            </div>
            <h2 className="text-base font-semibold">Opt-in & Contribute</h2>
          </div>
          <p className="text-sm">
            Choose how much ISK you want to invest in the next cycle. Send your
            investment to the designated character with your unique memo code to
            validate your participation.
          </p>
        </div>

        <div className="rounded-md border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <span className="text-sm font-semibold">2</span>
            </div>
            <h2 className="text-base font-semibold">Track Progress</h2>
          </div>
          <p className="text-sm">
            Follow your investment in real-time. See current cycle capital,
            inventory status, and your estimated share of profits as the trading
            cycle progresses.
          </p>
        </div>

        <div className="rounded-md border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <span className="text-sm font-semibold">3</span>
            </div>
            <h2 className="text-base font-semibold">Receive Payout</h2>
          </div>
          <p className="text-sm">
            When the cycle closes, receive your original investment plus your
            proportional share of the profits. All payouts are validated and
            tracked transparently.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">What You Get</h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>
                <strong>Passive Income:</strong> Earn ISK without active
                trading—we do the work
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>
                <strong>Full Transparency:</strong> View detailed reports on
                capital, trades, and profit calculations
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>
                <strong>Proportional Returns:</strong> Your share of profit is
                based on your investment percentage
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>
                <strong>Validated Transactions:</strong> All contributions and
                payouts verified via wallet journals
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-md border p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Important Information</h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>
                <strong>Cycle Duration:</strong> Cycles run for a defined
                period. Your ISK is locked during active trading.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BarChart3 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>
                <strong>Profit Variability:</strong> Returns depend on market
                conditions and trading opportunities—profits are not guaranteed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>
                <strong>Risk:</strong> Market trading carries inherent risk.
                While we use proven strategies, losses are possible. Only invest
                what you can afford to lose.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>
                <strong>Trust:</strong> This system requires trust in the
                operator. Review past cycle reports and performance before
                investing.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">Ready to Get Started?</h2>
        <p className="text-sm mb-4">
          Review the current cycle details, check out past performance reports,
          or opt-in to the next cycle to start earning passive income from
          professional EVE market trading.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tradecraft/cycles"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            View Current Cycle
          </Link>
          <Link
            href="/tradecraft/my-investments"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            View My Investments
          </Link>
          <Link
            href="/tradecraft/cycles/opt-in"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Opt-in to Next Cycle
          </Link>
        </div>
      </section>
    </div>
  );
}
