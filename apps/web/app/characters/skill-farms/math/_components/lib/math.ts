import type {
  SkillFarmMarketPricesSnapshot,
  SkillFarmSettings,
} from "@eve/shared/skill-contracts";

export type SkillFarmDerived = {
  spPerMinute: number;
  daysPerInjector: number;
  injectorsPer30Days: number;
  spPerCycle: number;
  extractorsPerCycle: number;
  injectorsPerCycle: number;
  injectorPrice: number;
  extractorPrice: number;
  salesTaxPct: number;
  brokerPct: number;
  feeMultiplier: number;
  subscriptionPerCharacter: number;
  netRevenue: number;
  totalCosts: number;
  netProfit: number;
  boosterCost: number;
  totalCharacters: number;
};

export type SkillFarmStatement = {
  units: number;
  grossSales: number;
  salesTax: number;
  brokerFee: number;
  netSales: number;
  cogs: number;
  boosters: number;
  subscription: number;
  totalExpenses: number;
  netProfit: number;
  derivedPer30d: number | null;
};

export function formatIsk(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString()} ISK`;
}

export function clampNonNegativeInt(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

export function getMarketPrice(
  snapshot: SkillFarmMarketPricesSnapshot | null | undefined,
  key: "PLEX" | "EXTRACTOR" | "INJECTOR",
) {
  const item = snapshot?.items?.find((x) => x.key === key);
  return item?.lowestSell ?? null;
}

export function deriveSkillFarmMath(args: {
  draft: SkillFarmSettings;
  marketPlex: number | null;
  marketExtractor: number | null;
  marketInjector: number | null;
  totalCharacters: number;
  omegaRequired: number;
  mctRequired: number;
  spPerMinute: number;
}): SkillFarmDerived {
  const {
    draft,
    marketPlex,
    marketExtractor,
    marketInjector,
    totalCharacters,
    omegaRequired,
    mctRequired,
    spPerMinute,
  } = args;

  const spm = spPerMinute > 0 ? spPerMinute : 0;
  const spPerDay = spm * 60 * 24;
  const daysPerInjector = spPerDay > 0 ? 500_000 / spPerDay : 0;
  const extractorsPerCycle = spm > 0 ? 1 : 0;
  const injectorsPerCycle = spm > 0 ? 1 : 0;
  const injectorsPer30Days = daysPerInjector > 0 ? 30 / daysPerInjector : 0;
  const spPerCycle = 500_000;

  const salesTaxPct = (draft.salesTaxPercent ?? 0) / 100;
  const brokerPct = (draft.brokerFeePercent ?? 0) / 100;
  const feeMultiplier = draft.soldViaContracts ? 1 : 1 - salesTaxPct - brokerPct;

  const effectivePlexPrice =
    (draft.plexPriceIsk ?? null) !== null ? (draft.plexPriceIsk ?? 0) : (marketPlex ?? 0);
  const plexPrice = effectivePlexPrice;
  const plexPerOmega = draft.plexPerOmega ?? 0;
  const plexPerMct = draft.plexPerMct ?? 0;

  const units = clampNonNegativeInt(totalCharacters);
  const omega = clampNonNegativeInt(omegaRequired);
  const mct = clampNonNegativeInt(mctRequired);

  const totalOmegaCost = omega * (plexPerOmega > 0 ? plexPerOmega * plexPrice : 0);
  const totalMctCost = mct * (plexPerMct > 0 ? plexPerMct * plexPrice : 0);
  const subscriptionTotal = totalOmegaCost + totalMctCost;
  const subscriptionProration = daysPerInjector > 0 ? daysPerInjector / 30 : 0;
  const proratedSubscriptionTotal = subscriptionTotal * subscriptionProration;
  const subscriptionPerCharacter = units > 0 ? proratedSubscriptionTotal / units : 0;

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
}

export function buildIncomeStatement(args: {
  derived: SkillFarmDerived;
  soldViaContracts: boolean;
}): SkillFarmStatement {
  const { derived, soldViaContracts } = args;
  const units = derived.totalCharacters;
  const grossSales = (derived.injectorPrice ?? 0) * units;
  const salesTax = soldViaContracts ? 0 : grossSales * (derived.salesTaxPct ?? 0);
  const brokerFee = soldViaContracts ? 0 : grossSales * (derived.brokerPct ?? 0);
  const netSales = grossSales - salesTax - brokerFee;

  const cogs = (derived.extractorPrice ?? 0) * units;
  const boosters = (derived.boosterCost ?? 0) * units;
  const subscription = (derived.subscriptionPerCharacter ?? 0) * units;
  const totalExpenses = boosters + subscription;
  const netProfit = netSales - cogs - totalExpenses;

  const derivedPer30d =
    derived.injectorsPer30Days > 0 ? netProfit * derived.injectorsPer30Days : null;

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
}
