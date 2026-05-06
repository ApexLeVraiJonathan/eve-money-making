import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@eve/ui";

export function CycleCreationCard({
  loading,
  planName,
  setPlanName,
  planInitialInjection,
  setPlanInitialInjection,
  planStart,
  setPlanStart,
  startName,
  setStartName,
  startInitialInjection,
  setStartInitialInjection,
  onPlan,
  onStart,
}: {
  loading: boolean;
  planName: string;
  setPlanName: (value: string) => void;
  planInitialInjection: string;
  setPlanInitialInjection: (value: string) => void;
  planStart: string;
  setPlanStart: (value: string) => void;
  startName: string;
  setStartName: (value: string) => void;
  startInitialInjection: string;
  setStartInitialInjection: (value: string) => void;
  onPlan: () => void;
  onStart: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <form
            className="space-y-4 p-4 rounded-md border bg-gradient-to-b from-background to-muted/10"
            onSubmit={(e) => {
              e.preventDefault();
              onPlan();
            }}
          >
            <div>
              <div className="font-medium">Plan a Cycle</div>
              <div className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">
                Schedules a future cycle for opt-ins. If no start date is set, it
                defaults to tomorrow.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-12">
              <div className="space-y-1 md:col-span-6">
                <Label htmlFor="plan-name" className="whitespace-nowrap">
                  Name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="plan-name"
                  placeholder="e.g. Cycle 6"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label htmlFor="plan-start" className="whitespace-nowrap">
                  Start <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="plan-start"
                  type="datetime-local"
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label htmlFor="plan-injection" className="whitespace-nowrap">
                  Injection (ISK)
                </Label>
                <Input
                  id="plan-injection"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={planInitialInjection}
                  onChange={(e) => setPlanInitialInjection(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                  Leave blank for no injection.
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={loading} className="w-full md:w-28">
                Plan
              </Button>
            </div>
          </form>

          <form
            className="space-y-4 p-4 rounded-md border bg-gradient-to-b from-background to-muted/10"
            onSubmit={(e) => {
              e.preventDefault();
              onStart();
            }}
          >
            <div>
              <div className="font-medium">Start a Cycle Now</div>
              <div className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">
                Creates and opens a cycle immediately using the current time.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-12">
              <div className="space-y-1 md:col-span-6">
                <Label htmlFor="start-name" className="whitespace-nowrap">
                  Name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="start-name"
                  placeholder="e.g. Cycle 6"
                  value={startName}
                  onChange={(e) => setStartName(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label htmlFor="start-now" className="whitespace-nowrap">
                  Start
                </Label>
                <Input id="start-now" value="Now" disabled />
                <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                  Uses the current time.
                </div>
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label htmlFor="start-injection" className="whitespace-nowrap">
                  Injection (ISK)
                </Label>
                <Input
                  id="start-injection"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={startInitialInjection}
                  onChange={(e) => setStartInitialInjection(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                  Leave blank for no injection.
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={loading} className="w-full md:w-28">
                Start
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
