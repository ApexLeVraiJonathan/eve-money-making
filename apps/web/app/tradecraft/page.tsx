import Link from "next/link";
import {
  CircleDollarSign,
  TrendingUp,
  Shield,
  Clock,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { NotificationsPrompt } from "@/components/notifications/notifications-prompt";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@eve/ui";

const FAQ_ITEMS = [
  {
    question: "What do I need to participate?",
    answer:
      "You’ll need to sign in with EVE so we can link your character(s) and track contributions/payouts. Then you opt-in to a cycle and follow the instructions to transfer ISK with your memo code.",
  },
  {
    question: "How is my profit share calculated?",
    answer:
      "Your share is proportional to your contribution relative to total cycle capital. You’ll see your share and the cycle’s numbers in the cycle views.",
  },
  {
    question: "Can I withdraw early?",
    answer:
      "Cycle capital is typically locked while the cycle is active. The current cycle view shows the rules and lifecycle for that cycle.",
  },
  {
    question: "Are profits guaranteed?",
    answer:
      "No. Market trading involves risk. Returns depend on market conditions and opportunities, and losses are possible. Only invest what you can afford to lose.",
  },
  {
    question: "How are contributions and payouts validated?",
    answer:
      "Contributions and payouts are verified using wallet journal records and participation validation flows in the app.",
  },
] as const;

export default function TradecraftOverviewPage() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-10">
        <NotificationsPrompt />

        {/* Hero */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-2xl font-semibold tracking-tight inline-flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                <CircleDollarSign className="h-6 w-6" />
              </span>
              Tradecraft
            </CardTitle>
            <CardDescription className="text-foreground/80">
              A managed market-trading program: you invest ISK into a cycle, we
              trade, you track results, and you get paid out when the cycle
              closes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
              <div>
                <p className="text-base leading-relaxed">
                  Earn passive ISK by contributing capital to professional EVE
                  market operations. We buy and sell across markets to generate
                  profit opportunities; at the end of the cycle you receive your
                  principal plus your share of profits (if any).
                </p>

                <ul className="mt-4 grid gap-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                    <span>
                      <strong>Simple participation:</strong> opt-in, transfer
                      ISK with a memo code, and you’re in.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                    <span>
                      <strong>Track live:</strong> cycle capital, inventory
                      status, and your estimated share.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                    <span>
                      <strong>Verified payout:</strong> contributions and
                      payouts are validated via wallet journals.
                    </span>
                  </li>
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/tradecraft/cycles">View current cycle</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/tradecraft/cycles/opt-in">
                      Opt-in to next cycle
                    </Link>
                  </Button>
                  <Button asChild variant="link" className="px-0">
                    <Link href="/tradecraft/cycle-history">
                      Browse past cycles
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-background/40 p-4 shadow-sm">
                <h2 className="text-sm font-semibold">At a glance</h2>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div className="flex gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <dt className="font-medium">Cycle-based</dt>
                      <dd className="text-foreground/80">
                        Your ISK is typically locked while a cycle is active.
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <BarChart3 className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <dt className="font-medium">Variable returns</dt>
                      <dd className="text-foreground/80">
                        Profits depend on market conditions and are not
                        guaranteed.
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Shield className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <dt className="font-medium">Trust & transparency</dt>
                      <dd className="text-foreground/80">
                        Review cycle details and history before investing.
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* How it works */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">How it works</h2>
            <p className="text-sm text-foreground/80">
              The flow is designed to be simple and auditable.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="gap-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="text-sm font-semibold">1</span>
                  </span>
                  Opt-in & contribute
                </CardTitle>
              <CardDescription className="text-foreground/80">
                  Choose an amount and follow the transfer instructions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80">
                  You opt-in to a cycle, then send ISK to the designated
                  character with your unique memo code so your participation can
                  be validated.
                </p>
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="text-sm font-semibold">2</span>
                  </span>
                  Track progress
                </CardTitle>
              <CardDescription className="text-foreground/80">
                  See the cycle evolve as trading happens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80">
                  Track capital, inventory status, and your estimated share as
                  the cycle progresses. You can also review cycle details and
                  history for context.
                </p>
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="text-sm font-semibold">3</span>
                  </span>
                  Receive payout
                </CardTitle>
              <CardDescription className="text-foreground/80">
                  Get your principal back plus your share.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80">
                  When the cycle closes, payouts are processed and tracked.
                  Contributions and payouts are validated through wallet journal
                  records.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

      {/* Features */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="gap-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                What you get
              </CardTitle>
              <CardDescription className="text-foreground/80">
                Designed for clarity and visibility.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <strong>Passive participation:</strong> earn exposure to
                    market trading without doing the day-to-day work.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <strong>Cycle dashboards:</strong> track capital,
                    contributions, and profit calculations.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <strong>Proportional returns:</strong> your share is based
                    on your percentage of total cycle capital.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <strong>Validated transfers:</strong> contributions and
                    payouts are verified via wallet journals.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="gap-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base inline-flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                What to know before investing
              </CardTitle>
              <CardDescription className="text-foreground/80">
                Set expectations up-front to build trust.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>
                    <strong>Cycle duration:</strong> cycle rules and timelines
                    are shown per cycle; your ISK is typically locked during
                    active trading.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>
                    <strong>Profit variability:</strong> returns depend on market
                    conditions—profits are not guaranteed.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>
                    <strong>Risk:</strong> losses are possible. Only invest what
                    you can afford to lose.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>
                    <strong>Trust:</strong> review the current cycle and cycle
                    history before opting in.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">FAQ</h2>
            <p className="text-sm text-foreground/80">
              Quick answers to the questions new investors usually have.
            </p>
          </div>

          <div className="grid gap-3">
            {FAQ_ITEMS.map((item) => (
              <Collapsible key={item.question} className="rounded-lg border bg-card">
                <CollapsibleTrigger className="group w-full px-4 py-3 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{item.question}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 text-sm text-foreground/80">
                  {item.answer}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </section>

      {/* Getting Started CTA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ready to get started?</CardTitle>
            <CardDescription className="text-foreground/80">
              Start by reviewing the current cycle, then opt in when you’re
              comfortable with the rules and risks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/tradecraft/cycles">View current cycle</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tradecraft/cycle-details">How payouts work</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tradecraft/my-investments">My investments</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/tradecraft/cycles/opt-in">Opt-in to next cycle</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
