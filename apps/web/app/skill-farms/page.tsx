import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Button } from "@eve/ui/button";

export const metadata: Metadata = {
  title: "Skill Farm Assistant",
};

export default function SkillFarmsIntroPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Skill Farm Assistant
        </h1>
        <p className="max-w-3xl text-base text-foreground/80">
          Plan, evaluate, and track EVE Online skill farms across your
          characters. Understand the requirements, run the ISK math, and get
          Discord alerts when it is time to extract or fix idle queues.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-b from-background to-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">1. Learn the basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/80">
            <p>
              Skill farms turn spare training alts into a steady ISK source by
              extracting skill points and selling injectors.
            </p>
            <p>
              You will generally park characters in a +5 training pod, use
              Biology/Cybernetics V and boosters, and let them train into a farm
              plan optimised for SP/hour.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">2. Prepare characters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/80">
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

        <Card className="bg-gradient-to-b from-background to-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">3. Run the numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/80">
            <p>
              Plug in your own PLEX deals, extractor/injector prices, and tax
              assumptions to see profit per character and per account.
            </p>
            <p>
              Decide how many accounts and characters make sense before you buy
              PLEX or set up new farms.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Card className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader>
            <CardTitle className="text-lg">Is skill farming for you?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-foreground/80 md:grid-cols-2">
            <div>
              <p className="mb-2 font-medium">
                Skill farming is usually a good fit if:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>You have spare alts that can sit in a training pod.</li>
                <li>
                  You are comfortable handling PLEX and market volatility over
                  long periods.
                </li>
                <li>
                  You prefer low-attention income once the system is set up.
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium">
                It may not be ideal right now if:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  You need those characters actively for gameplay most of the
                  time.
                </li>
                <li>
                  You cannot comfortably park ISK/PLEX across several months.
                </li>
                <li>
                  You are not interested in managing multiple accounts or
                  queues.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader>
            <CardTitle className="text-lg">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/skill-farms/characters">
              <Button className="w-full justify-center">
                Check my characters
              </Button>
            </Link>
            <Link href="/skill-farms/math">
              <Button variant="outline" className="w-full justify-center">
                Run the math
              </Button>
            </Link>
            <Link href="/skill-farms/tracking">
              <Button variant="ghost" className="w-full justify-center">
                View farm tracking
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
