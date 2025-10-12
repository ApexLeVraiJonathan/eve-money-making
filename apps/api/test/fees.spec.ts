import {
  applySellFees,
  computeUnitNetProfit,
  getEffectiveSell,
} from '../src/arbitrage/fees';

describe('fees helpers (unit)', () => {
  const fees = { salesTaxPercent: 3.37, brokerFeePercent: 1.5 };

  it('applySellFees reduces gross by combined percent', () => {
    const gross = 1000;
    const net = applySellFees(gross, fees);
    const expected = 1000 * (1 - (3.37 + 1.5) / 100);
    expect(net).toBeCloseTo(expected, 10);
  });

  it('computeUnitNetProfit = netSell - buyCost', () => {
    const buy = 800;
    const sellGross = 1000;
    const profit = computeUnitNetProfit(buy, sellGross, fees);
    const expected = getEffectiveSell(sellGross, fees) - buy;
    expect(Number(profit.toFixed(2))).toBe(Number(expected.toFixed(2)));
  });
});
