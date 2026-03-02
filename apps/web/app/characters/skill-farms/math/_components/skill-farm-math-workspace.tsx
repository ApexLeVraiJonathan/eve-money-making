"use client";

import * as React from "react";
import { toast } from "@eve/ui";
import {
  useSkillFarmSettings,
  useUpdateSkillFarmSettings,
  useSkillFarmMathPreview,
  useSkillFarmMarketPrices,
} from "../../api";
import {
  buildIncomeStatement,
  clampNonNegativeInt,
  deriveSkillFarmMath,
  getMarketPrice,
} from "./lib/math";
import { CalculatedResultsCard } from "./sections/calculated-results-card";
import { EconomicAssumptionsCard } from "./sections/economic-assumptions-card";
import { FarmShapeCard } from "./sections/farm-shape-card";
import { InputsHeaderCard } from "./sections/inputs-header-card";
import { MarketPricesCard } from "./sections/market-prices-card";

function buildMarketPlexHelpSuffix(label: string): string {
  const lowercase = label.toLowerCase();
  if (lowercase.includes("avg") || lowercase.includes("average")) {
    return "ESI average";
  }
  return "lowest sell";
}

export function SkillFarmMathWorkspace() {
  const { data: settings, isLoading: settingsLoading } = useSkillFarmSettings();
  const updateSettings = useUpdateSkillFarmSettings();
  const market = useSkillFarmMarketPrices();
  const { mutate: runPreview, status } = useSkillFarmMathPreview();

  const marketPlex = getMarketPrice(market.data, "PLEX");
  const marketExtractor = getMarketPrice(market.data, "EXTRACTOR");
  const marketInjector = getMarketPrice(market.data, "INJECTOR");
  const marketPlexLabel =
    market.data?.items?.find((x) => x.key === "PLEX")?.itemName ?? "PLEX";
  const marketPlexHelpSuffix = buildMarketPlexHelpSuffix(marketPlexLabel);

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
    const timeout = setTimeout(() => handleRecalculate(), 250);
    return () => clearTimeout(timeout);
  }, [autoRecalc, draft, handleRecalculate]);

  if (settingsLoading || !draft) {
    return <p className="text-sm text-foreground/80">Loading…</p>;
  }

  const derived = deriveSkillFarmMath({
    draft,
    marketPlex,
    marketExtractor,
    marketInjector,
    totalCharacters,
    omegaRequired,
    mctRequired,
    spPerMinute,
  });

  const statement = buildIncomeStatement({
    derived,
    soldViaContracts: !!draft.soldViaContracts,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
      <div className="space-y-6">
        <InputsHeaderCard
          isSaving={updateSettings.isPending}
          onReset={() => {
            setDraft(settings);
            toast.success("Reset to saved defaults");
          }}
          onSaveDefaults={() => {
            void (async () => {
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
                  managementMinutesPerCycle: draft.managementMinutesPerCycle,
                });
                toast.success("Saved as defaults");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : String(error),
                );
              }
            })();
          }}
        />

        <MarketPricesCard
          fetchedAt={market.data?.fetchedAt}
          isLoading={market.isLoading}
          hasData={!!market.data}
          marketPlexLabel={marketPlexLabel}
          marketPlex={marketPlex}
          marketExtractor={marketExtractor}
          marketInjector={marketInjector}
          onRefresh={() => {
            void market.refetch();
          }}
          onApplyAll={() => {
            setDraft((currentDraft) => {
              if (!currentDraft || !market.data) return currentDraft;
              return {
                ...currentDraft,
                plexPriceIsk: marketPlex ?? currentDraft.plexPriceIsk,
                extractorPriceIsk:
                  marketExtractor ?? currentDraft.extractorPriceIsk,
                injectorPriceIsk: marketInjector ?? currentDraft.injectorPriceIsk,
              };
            });
            toast.success("Applied market prices to inputs");
          }}
          onUsePlex={() => setDraft({ ...draft, plexPriceIsk: marketPlex })}
          onUseExtractor={() =>
            setDraft({ ...draft, extractorPriceIsk: marketExtractor })
          }
          onUseInjector={() =>
            setDraft({ ...draft, injectorPriceIsk: marketInjector })
          }
        />

        <EconomicAssumptionsCard
          draft={draft}
          setDraft={setDraft}
          marketPlex={marketPlex}
          marketExtractor={marketExtractor}
          marketInjector={marketInjector}
          marketPlexHelpSuffix={marketPlexHelpSuffix}
          boosterCost={derived.boosterCost}
        />

        <FarmShapeCard
          totalCharacters={totalCharacters}
          setTotalCharacters={setTotalCharacters}
          omegaRequired={omegaRequired}
          setOmegaRequired={setOmegaRequired}
          mctRequired={mctRequired}
          setMctRequired={setMctRequired}
          spPerMinute={spPerMinute}
          setSpPerMinute={setSpPerMinute}
          autoRecalc={autoRecalc}
          setAutoRecalc={setAutoRecalc}
          onRecalculate={handleRecalculate}
          isCalculating={status === "pending"}
          derived={derived}
        />
      </div>

      <CalculatedResultsCard
        derived={derived}
        statement={statement}
        soldViaContracts={!!draft.soldViaContracts}
      />
    </div>
  );
}
