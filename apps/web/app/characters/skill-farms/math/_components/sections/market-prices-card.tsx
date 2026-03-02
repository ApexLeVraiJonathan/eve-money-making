import { Button } from "@eve/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { formatIsk } from "../lib/math";

type MarketPricesCardProps = {
  fetchedAt: string | null | undefined;
  isLoading: boolean;
  hasData: boolean;
  marketPlexLabel: string;
  marketPlex: number | null;
  marketExtractor: number | null;
  marketInjector: number | null;
  onRefresh: () => void;
  onApplyAll: () => void;
  onUsePlex: () => void;
  onUseExtractor: () => void;
  onUseInjector: () => void;
};

export function MarketPricesCard({
  fetchedAt,
  isLoading,
  hasData,
  marketPlexLabel,
  marketPlex,
  marketExtractor,
  marketInjector,
  onRefresh,
  onApplyAll,
  onUsePlex,
  onUseExtractor,
  onUseInjector,
}: MarketPricesCardProps) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/5">
      <CardHeader className="gap-1">
        <CardTitle className="text-base">Market prices (optional)</CardTitle>
        <p className="text-sm text-foreground/80">
          Pull a hub snapshot and apply it to your inputs (you can still
          override manually).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-foreground/80">
            {fetchedAt
              ? `Last updated: ${new Date(fetchedAt).toLocaleString()}`
              : isLoading
                ? "Loading market snapshot…"
                : "Market snapshot unavailable."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
            <Button size="sm" disabled={!hasData} onClick={onApplyAll}>
              Apply all
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">{marketPlexLabel}</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatIsk(marketPlex)}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-7"
              disabled={marketPlex === null}
              onClick={onUsePlex}
            >
              Use
            </Button>
          </div>
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">Skill Extractor</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatIsk(marketExtractor)}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-7"
              disabled={marketExtractor === null}
              onClick={onUseExtractor}
            >
              Use
            </Button>
          </div>
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">Large Skill Injector</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatIsk(marketInjector)}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-7"
              disabled={marketInjector === null}
              onClick={onUseInjector}
            >
              Use
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
