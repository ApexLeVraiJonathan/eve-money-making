/**
 * Fee/tax helpers for consistent unit economics.
 *
 * Learning notes:
 * - Keep calculations pure and explicit. Accept numbers, return numbers.
 * - Caller is responsible for precision/rounding at the presentation layer.
 */

export type FeeInputs = {
  salesTaxPercent: number; // e.g., 3.37
  brokerFeePercent: number; // e.g., 1.5
};

/**
 * Applies sell-side fees (broker + sales tax) to a gross sell price.
 */
export function applySellFees(grossSellPrice: number, fees: FeeInputs): number {
  const totalPct = (fees.salesTaxPercent + fees.brokerFeePercent) / 100;
  return grossSellPrice * (1 - totalPct);
}

/**
 * Computes per-unit net profit given buy cost and gross sell price.
 */
export function computeUnitNetProfit(
  unitBuyCost: number,
  unitSellGross: number,
  fees: FeeInputs,
): number {
  const sellNet = applySellFees(unitSellGross, fees);
  return sellNet - unitBuyCost;
}
