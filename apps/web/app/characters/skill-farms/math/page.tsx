"use client";

import * as React from "react";
import {
  useSkillFarmSettings,
  useUpdateSkillFarmSettings,
  useSkillFarmMathPreview,
  useSkillFarmMarketPrices,
} from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Button } from "@eve/ui/button";
import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";
import { Checkbox } from "@eve/ui/checkbox";
import { Badge } from "@eve/ui/badge";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs";
import { toast } from "@eve/ui";
import { DollarSign, Package, Truck } from "lucide-react";

function formatIsk(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString()} ISK`;
}

function clampNonNegativeInt(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  help,
  step,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
      {help && <p className="text-xs text-foreground/80">{help}</p>}
    </div>
  );
}

function getMarketPrice(
  snapshot:
    | ReturnType<typeof useSkillFarmMarketPrices>["data"]
    | null
    | undefined,
  key: "PLEX" | "EXTRACTOR" | "INJECTOR",
) {
  const item = snapshot?.items?.find((x) => x.key === key);
  return item?.lowestSell ?? null;
}

function MathContent() {
  const { data: settings, isLoading: settingsLoading } = useSkillFarmSettings();
  const updateSettings = useUpdateSkillFarmSettings();
  const market = useSkillFarmMarketPrices();
  const { mutate: runPreview, status } = useSkillFarmMathPreview();

  const marketPlex = getMarketPrice(market.data, "PLEX");
  const marketExtractor = getMarketPrice(market.data, "EXTRACTOR");
  const marketInjector = getMarketPrice(market.data, "INJECTOR");
  const marketPlexLabel =
    market.data?.items?.find((x) => x.key === "PLEX")?.itemName ?? "PLEX";
  const marketPlexHelpSuffix =
    marketPlexLabel.toLowerCase().includes("avg") ||
    marketPlexLabel.toLowerCase().includes("average")
      ? "ESI average"
      : "lowest sell";

  const [draft, setDraft] = React.useState<typeof settings | null>(null);
  const [totalCharacters, setTotalCharacters] = React.useState(1);
  const [omegaRequired, setOmegaRequired] = React.useState(1);
  const [mctRequired, setMctRequired] = React.useState(0);
  const [spPerMinute, setSpPerMinute] = React.useState(63);
  const [autoRecalc, setAutoRecalc] = React.useState(true);

  React.useEffect(() => {
    if (!settings) return;
    setDraft(settings);
  }, [settings]);

  const handleRecalculate = React.useCallback(() => {
    if (!draft) return;
    const settingsForPreview = {
      ...draft,
      // If the user hasn't overridden these yet, use the current market snapshot
      // so the server preview matches the on-page derived math.
      plexPriceIsk:
        (draft.plexPriceIsk ?? null) !== null ? draft.plexPriceIsk : marketPlex,
      extractorPriceIsk:
        (draft.extractorPriceIsk ?? null) !== null
          ? draft.extractorPriceIsk
          : marketExtractor,
      injectorPriceIsk:
        (draft.injectorPriceIsk ?? null) !== null
          ? draft.injectorPriceIsk
          : marketInjector,
      boosterCostPerCycleIsk: null,
    };
    runPreview({
      settings: settingsForPreview,
      totalCharacters: clampNonNegativeInt(totalCharacters),
      omegaRequired: clampNonNegativeInt(omegaRequired),
      mctRequired: clampNonNegativeInt(mctRequired),
      // legacy fields kept for API compatibility, but not used by the UI anymore
      accounts: 0,
      farmCharactersPerAccount: 0,
      ignoreOmegaCostAccountIndexes: [],
      spPerMinutePerCharacter: spPerMinute,
    });
  }, [
    draft,
    totalCharacters,
    omegaRequired,
    mctRequired,
    runPreview,
    spPerMinute,
    marketPlex,
    marketExtractor,
    marketInjector,
  ]);

  React.useEffect(() => {
    if (!autoRecalc) return;
    if (!draft) return;
    const t = setTimeout(() => handleRecalculate(), 250);
    return () => clearTimeout(t);
  }, [autoRecalc, draft, handleRecalculate]);

  if (settingsLoading || !draft) {
    return <p className="text-sm text-foreground/80">Loading…</p>;
  }

  const derived = (() => {
    const spm = spPerMinute > 0 ? spPerMinute : 0;
    const spPerDay = spm * 60 * 24;
    const daysPerInjector = spPerDay > 0 ? 500_000 / spPerDay : 0;
    const extractorsPerCycle = spm > 0 ? 1 : 0;
    const injectorsPerCycle = spm > 0 ? 1 : 0;
    const injectorsPer30Days = daysPerInjector > 0 ? 30 / daysPerInjector : 0;
    const spPerCycle = 500_000;

    const salesTaxPct = (draft.salesTaxPercent ?? 0) / 100;
    const brokerPct = (draft.brokerFeePercent ?? 0) / 100;
    const feeMultiplier = draft.soldViaContracts
      ? 1
      : 1 - salesTaxPct - brokerPct;

    const effectivePlexPrice =
      (draft.plexPriceIsk ?? null) !== null
        ? (draft.plexPriceIsk ?? 0)
        : (marketPlex ?? 0);
    const plexPrice = effectivePlexPrice;
    const plexPerOmega = draft.plexPerOmega ?? 0;
    const plexPerMct = draft.plexPerMct ?? 0;

    const units = clampNonNegativeInt(totalCharacters);
    const omega = clampNonNegativeInt(omegaRequired);
    const mct = clampNonNegativeInt(mctRequired);

    const totalOmegaCost =
      omega * (plexPerOmega > 0 ? plexPerOmega * plexPrice : 0);
    const totalMctCost = mct * (plexPerMct > 0 ? plexPerMct * plexPrice : 0);
    const subscriptionTotal = totalOmegaCost + totalMctCost;
    const subscriptionProration =
      daysPerInjector > 0 ? daysPerInjector / 30 : 0;
    const proratedSubscriptionTotal = subscriptionTotal * subscriptionProration;
    const subscriptionPerCharacter =
      units > 0 ? proratedSubscriptionTotal / units : 0;

    const injectorPrice =
      (draft.injectorPriceIsk ?? null) !== null
        ? (draft.injectorPriceIsk ?? 0)
        : (marketInjector ?? 0);
    const extractorPrice =
      (draft.extractorPriceIsk ?? null) !== null
        ? (draft.extractorPriceIsk ?? 0)
        : (marketExtractor ?? 0);
    const boosterCost =
      draft.useBoosters !== false && plexPrice > 0 && daysPerInjector > 0
        ? plexPrice * 180 * (daysPerInjector / 26.4)
        : 0;

    const grossRevenue = injectorPrice * injectorsPerCycle;
    const netRevenue = grossRevenue * feeMultiplier;
    const extractorCost = extractorPrice * extractorsPerCycle;
    const nonSubCosts = boosterCost + extractorCost;
    const totalCosts = nonSubCosts + subscriptionPerCharacter;
    const netProfit = netRevenue - totalCosts;

    // These are useful for diagnostics, but not currently displayed in UI.
    // const plexCoeffPerCharacter =
    //   units > 0 ? (omega * plexPerOmega + mct * plexPerMct) / units : 0;
    // const plexCoeffPerInjector = plexCoeffPerCharacter * subscriptionProration;

    return {
      spPerMinute: spm,
      daysPerInjector,
      injectorsPer30Days,
      spPerCycle,
      extractorsPerCycle,
      injectorsPerCycle,
      injectorPrice,
      extractorPrice,
      salesTaxPct,
      brokerPct,
      feeMultiplier,
      subscriptionPerCharacter,
      netRevenue,
      totalCosts,
      netProfit,
      boosterCost,
      totalCharacters: units,
    };
  })();

  const statement = (() => {
    const units = derived.totalCharacters;
    const grossSales = (derived.injectorPrice ?? 0) * units;
    const salesTax = draft.soldViaContracts
      ? 0
      : grossSales * (derived.salesTaxPct ?? 0);
    const brokerFee = draft.soldViaContracts
      ? 0
      : grossSales * (derived.brokerPct ?? 0);
    const netSales = grossSales - salesTax - brokerFee;

    const cogs = (derived.extractorPrice ?? 0) * units;
    const boosters = (derived.boosterCost ?? 0) * units;
    const subscription = (derived.subscriptionPerCharacter ?? 0) * units;
    const totalExpenses = boosters + subscription;
    const netProfit = netSales - cogs - totalExpenses;

    const derivedPer30d =
      derived.injectorsPer30Days > 0
        ? netProfit * derived.injectorsPer30Days
        : null;

    return {
      units,
      grossSales,
      salesTax,
      brokerFee,
      netSales,
      cogs,
      boosters,
      subscription,
      totalExpenses,
      netProfit,
      derivedPer30d,
    };
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
      <div className="space-y-6">
        <Card className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Inputs</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(settings);
                    toast.success("Reset to saved defaults");
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  disabled={updateSettings.isPending}
                  onClick={async () => {
                    try {
                      await updateSettings.mutateAsync({
                        plexPriceIsk: draft.plexPriceIsk,
                        plexPerOmega: draft.plexPerOmega,
                        plexPerMct: draft.plexPerMct,
                        extractorPriceIsk: draft.extractorPriceIsk,
                        injectorPriceIsk: draft.injectorPriceIsk,
                        // Boosters are always derived from PLEX in the math model.
                        boosterCostPerCycleIsk: null,
                        useBoosters: draft.useBoosters !== false,
                        salesTaxPercent: draft.salesTaxPercent,
                        brokerFeePercent: draft.brokerFeePercent,
                        soldViaContracts: draft.soldViaContracts,
                        cycleDays: draft.cycleDays,
                        managementMinutesPerCycle:
                          draft.managementMinutesPerCycle,
                      });
                      toast.success("Saved as defaults");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Save defaults
                </Button>
              </div>
            </div>
            <p className="text-sm text-foreground/80">
              Adjust your assumptions below. The results panel calculates profit
              and shows a line-by-line breakdown for your farm.
            </p>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">
              Market prices (optional)
            </CardTitle>
            <p className="text-sm text-foreground/80">
              Pull a hub snapshot and apply it to your inputs (you can still
              override manually).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-foreground/80">
                {market.data?.fetchedAt
                  ? `Last updated: ${new Date(market.data.fetchedAt).toLocaleString()}`
                  : market.isLoading
                    ? "Loading market snapshot…"
                    : "Market snapshot unavailable."}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => market.refetch()}
                >
                  Refresh
                </Button>
                <Button
                  size="sm"
                  disabled={!market.data}
                  onClick={() => {
                    setDraft((d) => {
                      if (!d || !market.data) return d;
                      return {
                        ...d,
                        plexPriceIsk: marketPlex ?? d.plexPriceIsk,
                        extractorPriceIsk:
                          marketExtractor ?? d.extractorPriceIsk,
                        injectorPriceIsk: marketInjector ?? d.injectorPriceIsk,
                      };
                    });
                    toast.success("Applied market prices to inputs");
                  }}
                >
                  Apply all
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-background/40 p-3">
                <div className="text-xs text-foreground/80">
                  {marketPlexLabel}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {formatIsk(marketPlex)}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7"
                  disabled={marketPlex === null}
                  onClick={() =>
                    setDraft({ ...draft, plexPriceIsk: marketPlex })
                  }
                >
                  Use
                </Button>
              </div>
              <div className="rounded-md border bg-background/40 p-3">
                <div className="text-xs text-foreground/80">
                  Skill Extractor
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {formatIsk(marketExtractor)}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7"
                  disabled={marketExtractor === null}
                  onClick={() =>
                    setDraft({ ...draft, extractorPriceIsk: marketExtractor })
                  }
                >
                  Use
                </Button>
              </div>
              <div className="rounded-md border bg-background/40 p-3">
                <div className="text-xs text-foreground/80">
                  Large Skill Injector
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {formatIsk(marketInjector)}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7"
                  disabled={marketInjector === null}
                  onClick={() =>
                    setDraft({ ...draft, injectorPriceIsk: marketInjector })
                  }
                >
                  Use
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              onChange={(extractorPriceIsk) =>
                setDraft({ ...draft, extractorPriceIsk })
              }
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
              onChange={(injectorPriceIsk) =>
                setDraft({ ...draft, injectorPriceIsk })
              }
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
                  <div className="font-medium text-foreground">
                    {formatIsk(derived.boosterCost)}
                  </div>
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
              onChange={(salesTaxPercent) =>
                setDraft({ ...draft, salesTaxPercent })
              }
            />
            <NumberInput
              id="brokerFeePercent"
              label="Broker fee (%)"
              value={draft.brokerFeePercent}
              onChange={(brokerFeePercent) =>
                setDraft({ ...draft, brokerFeePercent })
              }
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
                Sold via contracts / direct trades (skip market tax & broker
                fees)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader>
            <CardTitle className="text-base">Farm shape</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <NumberInput
                id="totalCharacters"
                label="Number of characters"
                value={totalCharacters}
                onChange={(v) => setTotalCharacters(v ?? 0)}
                step={1}
              />
              <NumberInput
                id="omegaRequired"
                label="Number of Omega required"
                value={omegaRequired}
                onChange={(v) => setOmegaRequired(v ?? 0)}
                help="How many 30-day Omega subscriptions your farm consumes."
                step={1}
              />
              <NumberInput
                id="spPerMinute"
                label="SP per minute per character"
                value={spPerMinute}
                onChange={(v) => setSpPerMinute(v ?? 0)}
                help="Use your actual training speed (attributes + implants + boosters). Example: 63 SP/min."
                step={0.1}
              />
              <NumberInput
                id="mctRequired"
                label="Number of MCT required"
                value={mctRequired}
                onChange={(v) => setMctRequired(v ?? 0)}
                help="How many 30-day MCT subscriptions your farm consumes."
                step={1}
              />
              <div className="rounded-md border bg-background/40 p-3">
                <div className="text-xs text-foreground/80">
                  Characters total
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {derived.totalCharacters.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-foreground/70">
                  Using {clampNonNegativeInt(omegaRequired)} Omega and{" "}
                  {clampNonNegativeInt(mctRequired)} MCT
                </div>
              </div>
              <div className="rounded-md border bg-background/40 p-3">
                <div className="text-xs text-foreground/80">
                  Time per injector (500k SP)
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {derived.daysPerInjector > 0
                    ? `${derived.daysPerInjector.toFixed(2)} days`
                    : "—"}
                </div>
                <div className="mt-1 text-xs text-foreground/70">
                  {derived.injectorsPer30Days > 0
                    ? `${derived.injectorsPer30Days.toFixed(2)} injectors / 30d per character`
                    : "Set SP/min to compute"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <Checkbox
                  id="autoRecalc"
                  checked={autoRecalc}
                  onCheckedChange={(v) => setAutoRecalc(!!v)}
                />
                Auto recalculate
              </label>

              <Button
                onClick={handleRecalculate}
                disabled={status === "pending"}
                variant={autoRecalc ? "outline" : "default"}
              >
                {status === "pending" ? "Calculating…" : "Recalculate now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-b from-background to-muted/5 lg:sticky lg:top-4">
        <CardHeader className="gap-2">
          <CardTitle className="text-base">Calculated results</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statement.netProfit >= 0 ? "secondary" : "outline"}>
              {statement.netProfit >= 0 ? "Profitable" : "Not profitable"}
            </Badge>
            <div className="text-sm text-foreground/80">
              Farm totals / per injector window (
              {statement.units.toLocaleString()} injector
              {statement.units === 1 ? "" : "s"})
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">Net profit</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatIsk(statement.netProfit)}
            </div>
            <div className="mt-1 text-xs text-foreground/70">
              Net sales {formatIsk(statement.netSales)} − total costs{" "}
              {formatIsk(statement.cogs + statement.totalExpenses)}
            </div>
            <div className="mt-2 text-xs text-foreground/70">
              Derived:{" "}
              {statement.derivedPer30d !== null
                ? `${formatIsk(statement.derivedPer30d)} / 30d (farm)`
                : "set SP/min to compute / 30d"}
            </div>
          </div>

          <div className="rounded-md border bg-background/40 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <DollarSign className="h-4 w-4" />
              Income Statement (farm totals)
            </div>

            <div className="mt-4 space-y-6">
              {/* REVENUE */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  <DollarSign className="h-4 w-4" />
                  Revenue
                </div>
                <div className="ml-6 space-y-1">
                  <div className="flex justify-between gap-8 text-sm">
                    <span>
                      Gross Sales ({statement.units.toLocaleString()} injector
                      {statement.units === 1 ? "" : "s"})
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatIsk(statement.grossSales)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 text-sm">
                    <span>
                      Sales Tax ({(derived.salesTaxPct * 100).toFixed(2)}%)
                    </span>
                    <span
                      className={`tabular-nums font-medium ${draft.soldViaContracts ? "text-foreground/50" : "text-red-400"}`}
                    >
                      -{formatIsk(statement.salesTax)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 text-sm">
                    <span>
                      Broker Fee ({(derived.brokerPct * 100).toFixed(2)}%)
                    </span>
                    <span
                      className={`tabular-nums font-medium ${draft.soldViaContracts ? "text-foreground/50" : "text-red-400"}`}
                    >
                      -{formatIsk(statement.brokerFee)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 pt-2 border-t">
                    <span className="font-semibold">Net Sales Revenue</span>
                    <span className="tabular-nums font-bold">
                      {formatIsk(statement.netSales)}
                    </span>
                  </div>
                  {draft.soldViaContracts && (
                    <p className="pt-1 text-xs text-foreground/60">
                      Sold via contracts: market fees skipped.
                    </p>
                  )}
                </div>
              </div>

              {/* COGS */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  <Package className="h-4 w-4" />
                  Cost of Goods Sold
                </div>
                <div className="ml-6 space-y-1">
                  <div className="flex justify-between gap-8 text-sm">
                    <span>
                      {statement.units.toLocaleString()} extractor
                      {statement.units === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs opacity-70">
                      Avg: {formatIsk(derived.extractorPrice)}/unit
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 pt-2 border-t">
                    <span className="font-semibold">Total COGS</span>
                    <span className="tabular-nums font-bold text-red-400">
                      -{formatIsk(statement.cogs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* EXPENSES */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  <Truck className="h-4 w-4" />
                  Operating Expenses
                </div>
                <div className="ml-6 space-y-1">
                  <div className="flex justify-between gap-8 text-sm">
                    <span>Boosters (180 PLEX / 26.4d, prorated)</span>
                    <span className="tabular-nums font-medium text-red-400">
                      -{formatIsk(statement.boosters)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 text-sm">
                    <span>Subscription (Omega + MCT, prorated)</span>
                    <span className="tabular-nums font-medium text-red-400">
                      -{formatIsk(statement.subscription)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 pt-2 border-t">
                    <span className="font-semibold">Total Expenses</span>
                    <span className="tabular-nums font-bold text-red-400">
                      -{formatIsk(statement.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>

              {/* NET PROFIT */}
              <div className="bg-primary/10 -mx-3 px-3 py-3 border-t-2 rounded-md">
                <div className="flex justify-between gap-8 items-center">
                  <div>
                    <span className="font-bold">Net Profit</span>
                    <p className="text-xs text-foreground/70 mt-1">
                      = Net Sales − COGS − Operating Expenses
                    </p>
                  </div>
                  <span
                    className={`tabular-nums font-bold text-lg ${
                      statement.netProfit >= 0
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatIsk(statement.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-sm font-medium text-foreground">
              Farm totals (profitability)
            </div>
            <div className="mt-2 grid gap-1 text-foreground/80">
              <div className="flex items-center justify-between gap-3">
                <span>Profit / hour</span>
                <span className="font-medium text-foreground">
                  {derived.daysPerInjector > 0
                    ? `${Math.round(
                        statement.netProfit / (derived.daysPerInjector * 24),
                      ).toLocaleString()} ISK/h`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Profit / 30 days</span>
                <span className="font-medium text-foreground">
                  {statement.derivedPer30d !== null
                    ? formatIsk(statement.derivedPer30d)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Profit / year</span>
                <span className="font-medium text-foreground">
                  {statement.derivedPer30d !== null
                    ? formatIsk(statement.derivedPer30d * 12)
                    : "—"}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-foreground/70">
              Based on the Income Statement totals (farm-wide) and your time per
              injector.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SkillFarmMathPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <DynamicBreadcrumbs />
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Skill farm math &amp; planner
          </h1>
          <Badge variant="secondary" className="text-xs">
            Step 3 of 3
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-foreground/80">
          Configure your prices and farm layout to estimate profit, and see a
          detailed breakdown that makes it easy to sanity-check assumptions.
        </p>
      </header>
      <MathContent />
    </div>
  );
}
