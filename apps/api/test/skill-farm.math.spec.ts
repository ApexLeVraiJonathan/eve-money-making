import { SkillFarmMathService } from '../src/skill-farm/skill-farm.math.service';

describe('SkillFarmMathService', () => {
  const service = new SkillFarmMathService();

  it('computes zero profit when inputs are zero', () => {
    const result = service.compute({
      settings: {
        plexPriceIsk: 0,
        plexPerOmega: 0,
        plexPerMct: 0,
        extractorPriceIsk: 0,
        injectorPriceIsk: 0,
        boosterCostPerCycleIsk: 0,
        salesTaxPercent: 0,
        brokerFeePercent: 0,
        soldViaContracts: false,
        cycleDays: 30,
        managementMinutesPerCycle: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 1,
      farmCharactersPerAccount: 1,
      ignoreOmegaCostAccountIndexes: [],
      spPerDayPerCharacter: 0,
    });

    expect(result.perCharacter.netProfitIsk).toBe(0);
    expect(result.total.netProfitIsk).toBe(0);
  });

  it('produces positive profit when injector price exceeds costs', () => {
    const result = service.compute({
      settings: {
        plexPriceIsk: 4_000_000,
        plexPerOmega: 500,
        plexPerMct: null,
        extractorPriceIsk: 400_000_000,
        injectorPriceIsk: 800_000_000,
        boosterCostPerCycleIsk: 100_000_000,
        salesTaxPercent: 2,
        brokerFeePercent: 3,
        soldViaContracts: false,
        cycleDays: 30,
        managementMinutesPerCycle: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 1,
      farmCharactersPerAccount: 1,
      ignoreOmegaCostAccountIndexes: [],
      spPerDayPerCharacter: 50_000,
    });

    expect(result.perCharacter.spPerCycle).toBe(1_500_000);
    expect(result.perCharacter.extractorsPerCycle).toBe(3);
    expect(result.perCharacter.netProfitIsk).toBeGreaterThan(0);
  });
});
