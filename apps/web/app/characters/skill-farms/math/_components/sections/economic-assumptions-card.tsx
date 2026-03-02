import { Checkbox } from "@eve/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Label } from "@eve/ui/label";
import type { SkillFarmSettings } from "@eve/shared/skill-contracts";
import { formatIsk } from "../lib/math";
import { NumberInput } from "./number-input";

type EconomicAssumptionsCardProps = {
  draft: SkillFarmSettings;
  setDraft: (next: SkillFarmSettings) => void;
  marketPlex: number | null;
  marketExtractor: number | null;
  marketInjector: number | null;
  marketPlexHelpSuffix: string;
  boosterCost: number;
};

export function EconomicAssumptionsCard({
  draft,
  setDraft,
  marketPlex,
  marketExtractor,
  marketInjector,
  marketPlexHelpSuffix,
  boosterCost,
}: EconomicAssumptionsCardProps) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/5">
      <CardHeader>
        <CardTitle className="text-base">Economic assumptions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NumberInput
          id="plexPriceIsk"
          label="PLEX price (ISK per PLEX)"
          value={draft.plexPriceIsk}
          onChange={(plexPriceIsk) => setDraft({ ...draft, plexPriceIsk })}
          help={
            marketPlex
              ? `Market snapshot: ${formatIsk(marketPlex)} (${marketPlexHelpSuffix})`
              : "Use your effective price, including NES sales or Discord trades."
          }
        />
        <NumberInput
          id="plexPerOmega"
          label="PLEX per Omega (per account)"
          value={draft.plexPerOmega}
          onChange={(plexPerOmega) =>
            setDraft({ ...draft, plexPerOmega: plexPerOmega ?? null })
          }
          help="Applied once per account, per 30 days (after discounts)."
          step={1}
        />
        <NumberInput
          id="plexPerMct"
          label="PLEX per MCT (per extra character)"
          value={draft.plexPerMct}
          onChange={(plexPerMct) =>
            setDraft({ ...draft, plexPerMct: plexPerMct ?? null })
          }
          help="Used for 2nd/3rd training slots on an account."
          step={1}
        />
        <NumberInput
          id="extractorPriceIsk"
          label="Extractor cost (ISK each)"
          value={draft.extractorPriceIsk}
          onChange={(extractorPriceIsk) => setDraft({ ...draft, extractorPriceIsk })}
          help={
            marketExtractor
              ? `Market snapshot: ${formatIsk(marketExtractor)} (lowest sell)`
              : undefined
          }
        />
        <NumberInput
          id="injectorPriceIsk"
          label="Injector sell price (ISK each)"
          value={draft.injectorPriceIsk}
          onChange={(injectorPriceIsk) => setDraft({ ...draft, injectorPriceIsk })}
          help={
            marketInjector
              ? `Market snapshot: ${formatIsk(marketInjector)} (lowest sell)`
              : undefined
          }
        />
        <div className="space-y-1">
          <Label>Booster cost per character (ISK / injector)</Label>
          <div className="rounded-md border bg-background/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-foreground/80">
                {draft.useBoosters === false
                  ? "Disabled"
                  : "Auto (180 PLEX / 26.4 days)"}
              </div>
              <div className="font-medium text-foreground">{formatIsk(boosterCost)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Checkbox
              id="useBoosters"
              checked={draft.useBoosters !== false}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, useBoosters: !!checked })
              }
            />
            <Label htmlFor="useBoosters" className="text-xs font-normal">
              Use boosters (+12)
            </Label>
          </div>
          <p className="text-xs text-foreground/80">
            {draft.useBoosters === false
              ? "Boosters excluded from costs and break-even thresholds."
              : "Derived from your PLEX price and your time-to-injector: 180 × PLEX price × (daysPerInjector / 26.4)."}
          </p>
        </div>
        <NumberInput
          id="salesTaxPercent"
          label="Sales tax (%)"
          value={draft.salesTaxPercent}
          onChange={(salesTaxPercent) => setDraft({ ...draft, salesTaxPercent })}
        />
        <NumberInput
          id="brokerFeePercent"
          label="Broker fee (%)"
          value={draft.brokerFeePercent}
          onChange={(brokerFeePercent) => setDraft({ ...draft, brokerFeePercent })}
        />
        <div className="col-span-full flex items-center space-x-2 pt-1">
          <Checkbox
            id="soldViaContracts"
            checked={!!draft.soldViaContracts}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, soldViaContracts: !!checked })
            }
          />
          <Label htmlFor="soldViaContracts" className="text-xs font-normal">
            Sold via contracts / direct trades (skip market tax & broker fees)
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
