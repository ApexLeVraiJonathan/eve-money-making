import { Injectable } from '@nestjs/common';
import type {
  SkillFarmMathInputs,
  SkillFarmMathResult,
} from '@eve/api-contracts';

const EXTRACTOR_CHUNK_SP = 500_000;
const BOOSTER_PLEX_COST = 180;
const BOOSTER_DURATION_DAYS = 26.4;
const OMEGA_DURATION_DAYS = 30;

@Injectable()
export class SkillFarmMathService {
  compute(inputs: SkillFarmMathInputs): SkillFarmMathResult {
    const spPerMinute =
      inputs.spPerMinutePerCharacter && inputs.spPerMinutePerCharacter > 0
        ? inputs.spPerMinutePerCharacter
        : inputs.spPerDayPerCharacter && inputs.spPerDayPerCharacter > 0
          ? inputs.spPerDayPerCharacter / (60 * 24)
          : 0;
    const spPerDay = spPerMinute * 60 * 24;
    const daysPerInjector = spPerDay > 0 ? EXTRACTOR_CHUNK_SP / spPerDay : 0;
    const injectorsPer30DaysPerCharacter =
      daysPerInjector > 0 ? OMEGA_DURATION_DAYS / daysPerInjector : 0;

    // Per this planner model, we compute economics "per injector window":
    // the time it takes a character to train 500k SP.
    const spPerCycle = EXTRACTOR_CHUNK_SP;
    const extractorsPerCycle = spPerMinute > 0 ? 1 : 0;
    const injectorsPerCycle = spPerMinute > 0 ? 1 : 0;

    const plexPrice = inputs.settings.plexPriceIsk ?? 0;
    const plexPerOmega = inputs.settings.plexPerOmega ?? 0;
    const plexPerMct = inputs.settings.plexPerMct ?? 0;
    const extractorPrice = inputs.settings.extractorPriceIsk ?? 0;
    const injectorPrice = inputs.settings.injectorPriceIsk ?? 0;
    const useBoosters = inputs.settings.useBoosters ?? true;
    // Boosters are priced in PLEX (NES store): 180 PLEX for ~26.4 days.
    const boosterCost =
      useBoosters && plexPrice > 0 && daysPerInjector > 0
        ? plexPrice *
          BOOSTER_PLEX_COST *
          (daysPerInjector / BOOSTER_DURATION_DAYS)
        : 0;
    const salesTaxPct = (inputs.settings.salesTaxPercent ?? 0) / 100;
    const brokerPct = (inputs.settings.brokerFeePercent ?? 0) / 100;

    const accounts = inputs.accounts || 0;
    const charsPerAccount = inputs.farmCharactersPerAccount || 0;
    const legacyTotalCharacters = accounts * charsPerAccount;
    const totalCharacters =
      typeof inputs.totalCharacters === 'number'
        ? Math.max(0, Math.floor(inputs.totalCharacters))
        : legacyTotalCharacters;

    const feeMultiplier = inputs.settings.soldViaContracts
      ? 1
      : 1 - salesTaxPct - brokerPct;

    const perCharacterNonSubCosts =
      boosterCost + extractorPrice * extractorsPerCycle;

    // Subscription model (preferred):
    // - omegaRequired and mctRequired are explicit counts of 30-day periods needed for the farm
    // (lets users represent uneven account layouts).
    //
    // Legacy model (fallback):
    // - Omega cost is paid per account unless ignored
    // - MCT cost is paid per account for each extra training slot beyond the first
    const omegaCostPerOmega = plexPerOmega > 0 ? plexPerOmega * plexPrice : 0;
    const mctCostPerMct = plexPerMct > 0 ? plexPerMct * plexPrice : 0;

    const omegaRequired =
      typeof inputs.omegaRequired === 'number'
        ? Math.max(0, Math.floor(inputs.omegaRequired))
        : null;
    const mctRequired =
      typeof inputs.mctRequired === 'number'
        ? Math.max(0, Math.floor(inputs.mctRequired))
        : null;

    const ignoreOmegaSet = new Set<number>();
    for (const idx of inputs.ignoreOmegaCostAccountIndexes ?? []) {
      const n = Number(idx);
      if (!Number.isFinite(n)) continue;
      const i = Math.floor(n);
      if (i < 0 || i >= accounts) continue;
      ignoreOmegaSet.add(i);
    }

    const legacyOmegaRequired = Math.max(0, accounts - ignoreOmegaSet.size);
    const legacyMctRequired = accounts * Math.max(0, charsPerAccount - 1);

    const totalOmegaCost =
      (omegaRequired ?? legacyOmegaRequired) * omegaCostPerOmega;
    const totalMctCost = (mctRequired ?? legacyMctRequired) * mctCostPerMct;
    const totalSubscriptionCost = totalOmegaCost + totalMctCost;

    // Prorate subscription costs to the injector window (assume Omega/MCT are 30-day periods).
    const subscriptionProration =
      daysPerInjector > 0 ? daysPerInjector / OMEGA_DURATION_DAYS : 0;
    const proratedSubscriptionCost =
      totalSubscriptionCost * subscriptionProration;

    const perCharacterSubCost =
      totalCharacters > 0 ? proratedSubscriptionCost / totalCharacters : 0;

    const grossRevenue = injectorPrice * injectorsPerCycle;
    const netRevenue = grossRevenue * feeMultiplier;

    const perCharacterCosts = perCharacterNonSubCosts + perCharacterSubCost;
    const perCharNet = netRevenue - perCharacterCosts;

    const perCharacter: any = {
      spPerMinute,
      spPerDay,
      daysPerInjector,
      spPerCycle,
      extractorsPerCycle,
      injectorsPerCycle,
      totalCostsIsk: perCharacterCosts,
      grossRevenueIsk: grossRevenue,
      netProfitIsk: perCharNet,
    };

    // Per-account breakdown is not meaningful when the caller uses explicit omega/mct counts.
    // Keep legacy behavior when accounts/chars-per-account are provided; otherwise return empty.
    const perAccount: any[] = [];
    if (accounts > 0 && charsPerAccount > 0) {
      const omegaCostPerAccount =
        plexPerOmega > 0 ? plexPerOmega * plexPrice : 0;
      const mctCostPerAccount =
        charsPerAccount > 1 && plexPerMct > 0
          ? (charsPerAccount - 1) * plexPerMct * plexPrice
          : 0;

      for (let i = 0; i < accounts; i++) {
        const accountOmegaCost = ignoreOmegaSet.has(i)
          ? 0
          : omegaCostPerAccount;
        const accountSubscriptionCost =
          (accountOmegaCost + mctCostPerAccount) * subscriptionProration;
        const accountCosts =
          perCharacterNonSubCosts * charsPerAccount + accountSubscriptionCost;
        const accountGross = grossRevenue * charsPerAccount;
        const accountNetRevenue = netRevenue * charsPerAccount;
        const accountNetProfit = accountNetRevenue - accountCosts;

        perAccount.push({
          spPerMinute,
          spPerDay: spPerDay * charsPerAccount,
          daysPerInjector,
          spPerCycle: spPerCycle * charsPerAccount,
          extractorsPerCycle: extractorsPerCycle * charsPerAccount,
          injectorsPerCycle: injectorsPerCycle * charsPerAccount,
          totalCostsIsk: accountCosts,
          grossRevenueIsk: accountGross,
          netProfitIsk: accountNetProfit,
        });
      }
    }

    const totalCosts = perAccount.reduce(
      (acc, a) => acc + (a.totalCostsIsk ?? 0),
      0,
    );
    const totalGross = perAccount.reduce(
      (acc, a) => acc + (a.grossRevenueIsk ?? 0),
      0,
    );
    const totalNet = perAccount.reduce(
      (acc, a) => acc + (a.netProfitIsk ?? 0),
      0,
    );

    const total: any = {
      spPerMinute,
      spPerDay: spPerDay * totalCharacters,
      daysPerInjector,
      spPerCycle: spPerCycle * totalCharacters,
      extractorsPerCycle: extractorsPerCycle * totalCharacters,
      injectorsPerCycle: injectorsPerCycle * totalCharacters,
      totalCostsIsk: totalCosts,
      grossRevenueIsk: totalGross,
      netProfitIsk: totalNet,
    };

    const hours = daysPerInjector > 0 ? daysPerInjector * 24 : 0;
    const iskPerHour = hours > 0 ? total.netProfitIsk / hours : 0;

    return {
      inputs,
      injectorsPer30DaysPerCharacter,
      perCharacter,
      perAccount,
      total,
      iskPerHour,
    };
  }
}
