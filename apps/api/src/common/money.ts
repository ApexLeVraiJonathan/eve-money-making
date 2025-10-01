/**
 * Lightweight helpers for money arithmetic.
 *
 * Learning notes:
 * - JS numbers are IEEE-754 floats; tiny rounding errors can accumulate.
 * - For most ISK operations, careful rounding at boundaries is sufficient.
 * - If we later need stricter precision, swap implementations here (e.g. decimal.js).
 */

/**
 * Round to 2 decimals (banker rules are not needed here).
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum an array of numbers with basic guarding.
 */
export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
