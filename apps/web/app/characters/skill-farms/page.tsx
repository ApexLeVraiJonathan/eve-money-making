import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Button } from "@eve/ui/button";
import {
  BookOpen,
  UserCheck,
  Calculator,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@eve/ui/tooltip";

export const metadata: Metadata = {
  title: "Skill Farm Assistant",
};

// Tooltip wrapper component for EVE terms
function EveTerm({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-foreground/40">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function SkillFarmsIntroPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-20">
      <header className="relative overflow-hidden rounded-2xl border border-white/5 bg-[radial-gradient(circle_at_top,rgba(253,184,19,0.06)_0%,transparent_55%)] px-6 py-16 text-center sm:px-10 sm:py-20">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FDB813]/30 bg-[#FDB813]/15 shadow-[0_0_40px_rgba(253,184,19,0.20)]">
          <BarChart3 className="h-8 w-8 text-[#FDB813]" aria-hidden="true" />
        </div>

        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-bold tracking-[-0.02em] text-transparent [text-shadow:0_1px_0_rgba(255,255,255,0.06)] [background:linear-gradient(135deg,#FDB813_0%,#FF8C42_100%)] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] sm:text-6xl">
          Skill Farm Assistant
        </h1>

        <div className="mx-auto mt-8 max-w-[680px] space-y-3 text-lg leading-[1.7] text-[#A1A1AA] sm:text-xl">
          <p>
            Plan, evaluate, and track EVE Online skill farms across your
            characters.
          </p>
          <p>
            Understand the requirements, run the ISK math, and get alerts when
            it’s time to extract or fix idle queues.
          </p>
        </div>
      </header>

      <section aria-labelledby="sf-steps">
        <div className="mb-10 text-center">
          <h2
            id="sf-steps"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Your 3-step setup
          </h2>
          <p className="mx-auto mt-3 max-w-[680px] text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
            A guided flow from basics → readiness → profitability, with clear
            next actions.
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          <Card className="group h-full rounded-2xl border border-[#FDB813]/15 bg-[#2A2A2A] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-[#FDB813]/30 hover:shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            <CardHeader className="pb-2">
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-[#FDB813]/30 bg-[#FDB813]/15 px-4 py-2 text-[13px] font-bold tracking-wide text-[#FDB813]">
                Step 1 of 3
              </div>
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#FDB813]/30 bg-[#FDB813]/15 transition-transform duration-300 group-hover:rotate-2 group-hover:scale-[1.03]">
                <BookOpen
                  className="h-10 w-10 text-[#FDB813]"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="text-2xl font-semibold leading-snug text-foreground">
                Learn the basics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[15px] leading-relaxed text-[#9CA3AF]">
              <p>
                Turn spare training alts into steady{" "}
                <EveTerm tooltip="In-game currency: Interstellar Kredits">
                  ISK
                </EveTerm>{" "}
                by extracting{" "}
                <EveTerm tooltip="Skill points that can be extracted from trained skills">
                  skill points
                </EveTerm>{" "}
                and selling{" "}
                <EveTerm tooltip="Items that grant 500,000 skill points when consumed">
                  injectors
                </EveTerm>
                .
              </p>
              <p>
                The standard setup is a +5 training pod, Biology/Cybernetics V,
                boosters, and an optimised plan for{" "}
                <EveTerm tooltip="Skill Points per hour - the training rate">
                  SP/hour
                </EveTerm>
                .
              </p>
            </CardContent>
          </Card>

          <div className="pointer-events-none absolute left-1/3 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <ArrowRight
              className="h-7 w-7 text-[#FDB813]/50"
              aria-hidden="true"
            />
          </div>

          <Card className="group h-full rounded-2xl border border-[#FDB813]/15 bg-[#2A2A2A] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-[#FDB813]/30 hover:shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            <CardHeader className="pb-2">
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-[#FDB813]/30 bg-[#FDB813]/15 px-4 py-2 text-[13px] font-bold tracking-wide text-[#FDB813]">
                Step 2 of 3
              </div>
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#FDB813]/30 bg-[#FDB813]/15 transition-transform duration-300 group-hover:rotate-2 group-hover:scale-[1.03]">
                <UserCheck
                  className="h-10 w-10 text-[#FDB813]"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="text-2xl font-semibold leading-snug text-foreground">
                Prepare characters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[15px] leading-relaxed text-[#9CA3AF]">
              <p>
                Use the checklist to verify SP, required skills, remaps, Omega,
                and your training pod setup.
              </p>
              <p>
                Once a character is ready, mark it active and attach a farm plan
                to track extractable SP.
              </p>
            </CardContent>
          </Card>

          <div className="pointer-events-none absolute left-2/3 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <ArrowRight
              className="h-7 w-7 text-[#FDB813]/50"
              aria-hidden="true"
            />
          </div>

          <Card className="group h-full rounded-2xl border border-[#FDB813]/15 bg-[#2A2A2A] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-[#FDB813]/30 hover:shadow-[0_12px_24px_rgba(0,0,0,0.30)]">
            <CardHeader className="pb-2">
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-[#FDB813]/30 bg-[#FDB813]/15 px-4 py-2 text-[13px] font-bold tracking-wide text-[#FDB813]">
                Step 3 of 3
              </div>
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#FDB813]/30 bg-[#FDB813]/15 transition-transform duration-300 group-hover:rotate-2 group-hover:scale-[1.03]">
                <Calculator
                  className="h-10 w-10 text-[#FDB813]"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="text-2xl font-semibold leading-snug text-foreground">
                Run the numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[15px] leading-relaxed text-[#9CA3AF]">
              <p>
                Plug in your{" "}
                <EveTerm tooltip="Pilot's License Extension - subscription currency">
                  PLEX
                </EveTerm>{" "}
                cost, extractor/injector prices, and fees.
              </p>
              <p>
                Compare profit per character and per account before scaling up.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="sf-fit">
        <div className="text-center">
          <h2
            id="sf-fit"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Is skill farming for you?
          </h2>
          <p className="mx-auto mt-3 max-w-[680px] text-sm leading-relaxed text-[#9CA3AF] sm:text-base">
            Evaluate if skill farming matches your playstyle and goals.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Card className="group relative overflow-hidden rounded-xl border-2 border-[#22C55E]/30 bg-[rgba(34,197,94,0.08)] p-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.20)]">
            <div className="pointer-events-none absolute right-4 top-4 rounded-xl bg-[#16A34A] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-black">
              Recommended
            </div>
            <CardHeader className="pb-3">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22C55E]/15">
                  <CheckCircle2
                    className="h-5 w-5 text-[#22C55E]"
                    aria-hidden="true"
                  />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Good fit if you…
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-[15px] leading-[1.8] text-[#D1D5DB]">
              <ul className="space-y-4">
                <li className="flex gap-3 border-l-2 border-[#22C55E]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]/20 text-xs font-bold text-[#22C55E]">
                    ✓
                  </span>
                  <span>Have spare alts that can sit in a training pod.</span>
                </li>
                <li className="flex gap-3 border-l-2 border-[#22C55E]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]/20 text-xs font-bold text-[#22C55E]">
                    ✓
                  </span>
                  <span>
                    Are comfortable handling{" "}
                    <EveTerm tooltip="Pilot's License Extension - subscription currency">
                      PLEX
                    </EveTerm>{" "}
                    and market volatility over long periods.
                  </span>
                </li>
                <li className="flex gap-3 border-l-2 border-[#22C55E]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]/20 text-xs font-bold text-[#22C55E]">
                    ✓
                  </span>
                  <span>
                    Prefer low-attention income once the system is set up.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="group rounded-xl border-2 border-[#EAB308]/30 bg-[rgba(234,179,8,0.08)] p-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAB308]/15">
                  <AlertTriangle
                    className="h-5 w-5 text-[#EAB308]"
                    aria-hidden="true"
                  />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  May not be ideal if you…
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-[15px] leading-[1.8] text-[#D1D5DB]">
              <ul className="space-y-4">
                <li className="flex gap-3 border-l-2 border-[#EAB308]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EAB308]/20 text-xs font-bold text-[#EAB308]">
                    !
                  </span>
                  <span>
                    Need those characters actively for gameplay most of the
                    time.
                  </span>
                </li>
                <li className="flex gap-3 border-l-2 border-[#EAB308]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EAB308]/20 text-xs font-bold text-[#EAB308]">
                    !
                  </span>
                  <span>
                    Cannot comfortably park ISK/PLEX across several months.
                  </span>
                </li>
                <li className="flex gap-3 border-l-2 border-[#EAB308]/20 pl-4">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EAB308]/20 text-xs font-bold text-[#EAB308]">
                    !
                  </span>
                  <span>Don’t want to manage multiple accounts or queues.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="sf-cta">
        <Card className="rounded-2xl border border-[#FDB813]/20 bg-[linear-gradient(135deg,#2A2A2A_0%,#1F1F1F_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <CardHeader className="pb-3 text-center">
            <CardTitle
              id="sf-cta"
              className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            >
              Ready to get started?
            </CardTitle>
            <p className="mx-auto mt-3 max-w-[680px] text-sm text-[#A1A1AA] sm:text-base">
              Follow these steps to set up your skill farm.
            </p>
          </CardHeader>
          <CardContent className="mt-4 flex flex-col gap-4">
            <Link href="/characters/skill-farms/characters" className="w-full">
              <Button
                size="lg"
                className="sf-pulse-glow w-full justify-center rounded-xl bg-[linear-gradient(135deg,#FDB813_0%,#FF8C42_100%)] px-9 py-6 text-[17px] font-semibold text-black shadow-[0_4px_12px_rgba(253,184,19,0.30)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_24px_rgba(253,184,19,0.40)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(253,184,19,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB813] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <UserCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                Assess My Characters
              </Button>
            </Link>

            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/characters/skill-farms/math" className="w-full">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-center rounded-[10px] border-2 border-[#404040] bg-transparent px-8 py-5 text-[15px] font-medium text-[#E5E5E5] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FDB813]/50 hover:bg-[#FDB813]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB813] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Calculator className="mr-2 h-5 w-5" aria-hidden="true" />
                  Calculate Profitability
                </Button>
              </Link>

              <Link href="/characters/skill-farms/tracking" className="w-full">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-center rounded-[10px] border-2 border-[#404040] bg-transparent px-8 py-5 text-[15px] font-medium text-[#E5E5E5] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FDB813]/50 hover:bg-[#FDB813]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB813] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <TrendingUp className="mr-2 h-5 w-5" aria-hidden="true" />
                  View Farm Tracking
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
