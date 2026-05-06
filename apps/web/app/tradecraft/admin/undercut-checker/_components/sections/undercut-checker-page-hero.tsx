import { TrendingDown } from "lucide-react";

export function UndercutCheckerPageHero() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
        <TrendingDown className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Undercut Checker</h1>
        <p className="text-sm text-muted-foreground">
          Check for undercuts and manage repricing
        </p>
      </div>
    </div>
  );
}
