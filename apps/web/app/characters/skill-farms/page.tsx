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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Skill Farm Assistant
        </h1>
        <p className="max-w-3xl text-base text-foreground/90">
          Plan, evaluate, and track EVE Online skill farms across your
          characters. Understand the requirements, run the ISK math, and get
          Discord alerts when it is time to extract or fix idle queues.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-muted/40 bg-gradient-to-br from-background via-background to-muted/20">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">1. Learn the basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/95">
            <p>
              Skill farms turn spare training alts into a steady{" "}
              <EveTerm tooltip="In-game currency: Interstellar Kredits">
                ISK
              </EveTerm>{" "}
              source by extracting{" "}
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
              You will generally park characters in a +5 training pod, use
              Biology/Cybernetics V and boosters, and let them train into a farm
              plan optimised for{" "}
              <EveTerm tooltip="Skill Points per hour - the training rate">
                SP/hour
              </EveTerm>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/40 bg-gradient-to-br from-background via-background to-muted/20">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">2. Prepare characters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/95">
            <p>
              Use the character checklist to see which of your characters meet
              the skill farm requirements and what is still missing.
            </p>
            <p>
              Once they are ready, mark them as active farm characters and
              assign a farm skill plan to define which skills are extractable.
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted/40 bg-gradient-to-br from-background via-background to-muted/20">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">3. Run the numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/95">
            <p>
              Plug in your own{" "}
              <EveTerm tooltip="Pilot's License Extension - subscription currency">
                PLEX
              </EveTerm>{" "}
              deals,{" "}
              <EveTerm tooltip="Tools to extract skill points from characters">
                extractor
              </EveTerm>
              /
              <EveTerm tooltip="Items that grant 500,000 skill points when consumed">
                injector
              </EveTerm>{" "}
              prices, and tax assumptions to see profit per character and per
              account.
            </p>
            <p>
              Decide how many accounts and characters make sense before you buy
              PLEX or set up new farms.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-muted/40 bg-gradient-to-br from-background to-muted/10">
          <CardHeader>
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                Is skill farming for you?
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 text-sm text-foreground/95 md:grid-cols-2">
            <div>
              <p className="mb-3 flex items-center gap-2 font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Good fit if you:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Have spare alts that can sit in a training pod.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Are comfortable handling{" "}
                    <EveTerm tooltip="Pilot's License Extension - subscription currency">
                      PLEX
                    </EveTerm>{" "}
                    and market volatility over long periods.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Prefer low-attention income once the system is set up.
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 flex items-center gap-2 font-semibold text-amber-400">
                <BarChart3 className="h-4 w-4" />
                May not be ideal if you:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Need those characters actively for gameplay most of the
                    time.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Cannot comfortably park ISK/PLEX across several months.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Are not interested in managing multiple accounts or queues.
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Ready to get started?</CardTitle>
            <p className="text-sm text-foreground/90">
              Follow these steps to set up your skill farm
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/characters/skill-farms/characters" className="w-full">
              <Button className="w-full justify-center text-base" size="lg">
                <UserCheck className="mr-2 h-5 w-5" />
                Assess My Characters
              </Button>
            </Link>
            <Link href="/characters/skill-farms/math" className="w-full">
              <Button
                variant="outline"
                className="w-full justify-center"
                size="lg"
              >
                <Calculator className="mr-2 h-5 w-5" />
                Calculate Profitability
              </Button>
            </Link>
            <Link href="/characters/skill-farms/tracking" className="w-full">
              <Button
                variant="ghost"
                className="w-full justify-center"
                size="lg"
              >
                <TrendingUp className="mr-2 h-5 w-5" />
                View Farm Tracking
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
