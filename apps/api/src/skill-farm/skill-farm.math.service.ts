import { Injectable } from '@nestjs/common';
import type {
  SkillFarmMathInputs,
  SkillFarmMathResult,
} from '@eve/api-contracts';

const EXTRACTOR_CHUNK_SP = 500_000;

@Injectable()
export class SkillFarmMathService {
  compute(inputs: SkillFarmMathInputs): SkillFarmMathResult {
    const cycleDays = inputs.settings.cycleDays ?? 30;
    const spPerDay =
      inputs.spPerDayPerCharacter && inputs.spPerDayPerCharacter > 0
        ? inputs.spPerDayPerCharacter
        : 0;
    const spPerCycle = spPerDay * cycleDays;
    const extractorsPerCycle = Math.max(
      0,
      Math.floor(spPerCycle / EXTRACTOR_CHUNK_SP),
    );
    const injectorsPerCycle = extractorsPerCycle;

    const plexPrice = inputs.settings.plexPriceIsk ?? 0;
    const plexPerOmega = inputs.settings.plexPerOmega ?? 0;
    const extractorPrice = inputs.settings.extractorPriceIsk ?? 0;
    const injectorPrice = inputs.settings.injectorPriceIsk ?? 0;
    const boosterCost = inputs.settings.boosterCostPerCycleIsk ?? 0;
    const salesTaxPct = (inputs.settings.salesTaxPercent ?? 0) / 100;
    const brokerPct = (inputs.settings.brokerFeePercent ?? 0) / 100;

    const accounts = inputs.accounts || 0;
    const charsPerAccount = inputs.farmCharactersPerAccount || 0;
    const totalCharacters = accounts * charsPerAccount;

    const perCharacterCosts =
      (plexPerOmega > 0 ? plexPerOmega * plexPrice : 0) +
      boosterCost +
      extractorPrice * extractorsPerCycle;

    const grossRevenue = injectorPrice * injectorsPerCycle;
    const feeMultiplier = inputs.settings.soldViaContracts
      ? 1
      : 1 - salesTaxPct - brokerPct;
    const netRevenue = grossRevenue * feeMultiplier;

    const perCharNet = netRevenue - perCharacterCosts;

    const perCharacter: any = {
      spPerDay,
      spPerCycle,
      extractorsPerCycle,
      injectorsPerCycle,
      totalCostsIsk: perCharacterCosts,
      grossRevenueIsk: grossRevenue,
      netProfitIsk: perCharNet,
    };

    const perAccount: any[] = [];
    for (let i = 0; i < accounts; i++) {
      perAccount.push({
        ...perCharacter,
        netProfitIsk: perCharNet * charsPerAccount,
        totalCostsIsk: perCharacterCosts * charsPerAccount,
        grossRevenueIsk: grossRevenue * charsPerAccount,
      });
    }

    const total: any = {
      ...perCharacter,
      netProfitIsk: perCharNet * totalCharacters,
      totalCostsIsk: perCharacterCosts * totalCharacters,
      grossRevenueIsk: grossRevenue * totalCharacters,
    };

    const managementMinutes = inputs.settings.managementMinutesPerCycle ?? 0;
    const hours =
      managementMinutes > 0 ? managementMinutes / 60 : cycleDays * 24;
    const iskPerHour = hours > 0 ? total.netProfitIsk / hours : 0;

    return {
      inputs,
      perCharacter,
      perAccount,
      total,
      iskPerHour,
    };
  }
}
