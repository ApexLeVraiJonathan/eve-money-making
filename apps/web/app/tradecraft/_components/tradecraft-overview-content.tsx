import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Shield,
  TrendingUp,
} from "lucide-react";
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

const overviewItems = [
  "Simple participation: opt-in, transfer ISK with a memo code, and you are in.",
  "Track live: cycle capital, inventory status, and your estimated share.",
  "Verified payout: contributions and payouts are validated via wallet journals.",
] as const;

const steps = [
  {
    title: "Opt-in & contribute",
    description: "Choose an amount and follow the transfer instructions.",
    body: "You opt in to a cycle, then send ISK to the designated character with your unique memo code so your participation can be validated.",
  },
  {
    title: "Track progress",
    description: "See the cycle evolve as trading happens.",
    body: "Track capital, inventory status, and your estimated share as the cycle progresses. You can also review cycle details and history for context.",
  },
  {
    title: "Receive payout",
    description: "Get your principal back plus your share.",
    body: "When the cycle closes, payouts are processed and tracked. Contributions and payouts are validated through wallet journal records.",
  },
] as const;

const benefits = [
  "Passive participation: earn exposure to market trading without doing the day-to-day work.",
  "Cycle dashboards: track capital, contributions, and profit calculations.",
  "Proportional returns: your share is based on your percentage of total cycle capital.",
  "Validated transfers: contributions and payouts are verified via wallet journals.",
] as const;

const risks = [
  "Cycle duration: cycle rules and timelines are shown per cycle; your ISK is typically locked during active trading.",
  "Profit variability: returns depend on market conditions and profits are not guaranteed.",
  "Risk: losses are possible. Only invest what you can afford to lose.",
  "Trust: review the current cycle and cycle history before opting in.",
] as const;

const faqs = [
  {
    question: "What do I need to participate?",
    answer:
      "Sign in with EVE, link your character, opt in to a cycle, then transfer ISK with your memo code.",
  },
  {
    question: "How is my profit share calculated?",
    answer:
      "Your share is proportional to your contribution relative to total cycle capital.",
  },
  {
    question: "Can I withdraw early?",
    answer:
      "Cycle capital is typically locked while the cycle is active. The current cycle view shows the rules for each cycle.",
  },
  {
    question: "Are profits guaranteed?",
    answer:
      "No. Market trading involves risk and returns depend on market conditions.",
  },
] as const;

export function TradecraftOverviewContent() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <InfoCardsSection />
      <FaqSection />
      <GettingStartedCard />
    </>
  );
}

function HeroSection() {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <CircleDollarSign className="h-6 w-6" />
          </span>
          Tradecraft
        </CardTitle>
        <CardDescription className="text-foreground/80">
          A managed market-trading program: you invest ISK into a cycle, we
          trade, you track results, and you get paid out when the cycle closes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-base leading-relaxed">
            Earn passive ISK by contributing capital to professional EVE market
            operations. At the end of the cycle you receive your principal plus
            your share of profits, if any.
          </p>
          <ul className="mt-4 grid gap-2 text-sm">
            {overviewItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/tradecraft/cycles">View current cycle</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tradecraft/cycles/opt-in">Opt-in to next cycle</Link>
            </Button>
            <Button asChild variant="link" className="px-0">
              <Link href="/tradecraft/cycle-history">Browse past cycles</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-lg border bg-background/40 p-4 shadow-sm">
          <h2 className="text-sm font-semibold">At a glance</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <SummaryItem icon={Clock} label="Cycle-based">
              Your ISK is typically locked while a cycle is active.
            </SummaryItem>
            <SummaryItem icon={BarChart3} label="Variable returns">
              Profits depend on market conditions and are not guaranteed.
            </SummaryItem>
            <SummaryItem icon={Shield} label="Trust & transparency">
              Review cycle details and history before investing.
            </SummaryItem>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function HowItWorksSection() {
  return (
    <section className="space-y-4">
      <SectionHeading
        title="How it works"
        description="The flow is designed to be simple and auditable."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title} className="gap-3">
            <CardHeader className="pb-2">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <span className="text-sm font-semibold">{index + 1}</span>
                </span>
                {step.title}
              </CardTitle>
              <CardDescription className="text-foreground/80">
                {step.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function InfoCardsSection() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <BulletCard
        icon={TrendingUp}
        title="What you get"
        description="Designed for clarity and visibility."
        items={benefits}
      />
      <BulletCard
        icon={AlertCircle}
        title="What to know before investing"
        description="Set expectations up-front to build trust."
        items={risks}
      />
    </section>
  );
}

function FaqSection() {
  return (
    <section className="space-y-4">
      <SectionHeading
        title="FAQ"
        description="Quick answers to the questions new investors usually have."
      />
      <div className="grid gap-3">
        {faqs.map((item) => (
          <Collapsible
            key={item.question}
            className="rounded-lg border bg-card"
          >
            <CollapsibleTrigger className="group w-full rounded-lg px-4 py-3 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
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
  );
}

function GettingStartedCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Ready to get started?</CardTitle>
        <CardDescription className="text-foreground/80">
          Start by reviewing the current cycle, then opt in when you are
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
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-foreground/80">{description}</p>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div>
        <dt className="font-medium">{label}</dt>
        <dd className="text-foreground/80">{children}</dd>
      </div>
    </div>
  );
}

function BulletCard({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof TrendingUp;
  title: string;
  description: string;
  items: readonly string[];
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="pb-2">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-foreground/80">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
