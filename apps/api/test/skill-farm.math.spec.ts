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
        extractionTargetSkillIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 1,
      farmCharactersPerAccount: 1,
      ignoreOmegaCostAccountIndexes: [],
      spPerMinutePerCharacter: 0,
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
        injectorPriceIsk: 1_500_000_000,
        boosterCostPerCycleIsk: 100_000_000,
        salesTaxPercent: 2,
        brokerFeePercent: 3,
        soldViaContracts: false,
        cycleDays: 30,
        managementMinutesPerCycle: 60,
        extractionTargetSkillIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 1,
      farmCharactersPerAccount: 1,
      ignoreOmegaCostAccountIndexes: [],
      spPerMinutePerCharacter: 50_000 / (60 * 24),
    });

    expect(result.perCharacter.spPerCycle).toBe(500_000);
    expect(result.perCharacter.extractorsPerCycle).toBe(1);
    expect(result.perCharacter.netProfitIsk).toBeGreaterThan(0);
  });

  it('treats Omega as per-account and supports ignoring Omega cost for selected accounts', () => {
    const result = service.compute({
      settings: {
        plexPriceIsk: 1,
        plexPerOmega: 10,
        plexPerMct: 5,
        extractorPriceIsk: 0,
        injectorPriceIsk: 0,
        boosterCostPerCycleIsk: 0,
        salesTaxPercent: 0,
        brokerFeePercent: 0,
        soldViaContracts: true,
        cycleDays: 30,
        managementMinutesPerCycle: 0,
        extractionTargetSkillIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 2,
      farmCharactersPerAccount: 2,
      ignoreOmegaCostAccountIndexes: [0],
      spPerMinutePerCharacter: 0,
    });

    // Omega: account 1 pays 10; account 0 ignored => 0
    // MCT: (2 chars => 1 MCT) per account => 5 each, total 10
    // Total subscription cost = 20; no other costs, no revenue
    // Because SP/min is 0, the injector window length is 0 => subscription proration is 0.
    // In this mode, costs are prorated to the time-to-injector window.
    expect(result.total.totalCostsIsk).toBe(0);
    expect(result.total.netProfitIsk).toBe(0);

    // Per-character also has zero costs under zero training speed.
    expect(result.perCharacter.totalCostsIsk).toBe(0);
    expect(result.perCharacter.netProfitIsk).toBe(0);

    expect(result.perAccount).toHaveLength(2);
    expect(result.perAccount[0].totalCostsIsk).toBe(0);
    expect(result.perAccount[0].netProfitIsk).toBe(0);
    expect(result.perAccount[1].totalCostsIsk).toBe(0);
    expect(result.perAccount[1].netProfitIsk).toBe(0);
  });

  it('prorates Omega/MCT costs to the injector window', () => {
    const result = service.compute({
      settings: {
        plexPriceIsk: 1,
        plexPerOmega: 30, // 30 PLEX for 30d => 1 PLEX/day
        plexPerMct: 0,
        extractorPriceIsk: 0,
        injectorPriceIsk: 0,
        boosterCostPerCycleIsk: null,
        salesTaxPercent: 0,
        brokerFeePercent: 0,
        soldViaContracts: true,
        cycleDays: 30,
        managementMinutesPerCycle: null,
        extractionTargetSkillIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      accounts: 1,
      farmCharactersPerAccount: 1,
      ignoreOmegaCostAccountIndexes: [],
      // 500k SP at 500k SP/day => 1 day per injector
      spPerMinutePerCharacter: 500_000 / (60 * 24),
    });

    expect(result.perCharacter.daysPerInjector).toBeCloseTo(1, 6);
    // Prorated subscription: 30 PLEX * (1/30) = 1
    // Booster: 180 PLEX * (1/26.4) ≈ 6.818...
    expect(result.perCharacter.totalCostsIsk).toBeCloseTo(
      1 + 180 * (1 / 26.4),
      6,
    );
  });
});
