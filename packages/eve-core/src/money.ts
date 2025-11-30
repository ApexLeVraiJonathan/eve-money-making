/**
 * Money helpers and tick sizing utilities for EVE ISK calculations.
 *
 * This was extracted from the API `common/money` module so it can be reused
 * across multiple apps (Tradecraft, Skill Farm, tools, etc.).
 *
 * All functions are pure and framework-agnostic.
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

/**
 * EVE market price tick sizing: at most 4 significant digits.
 * We implement helpers to snap to the nearest valid tick at or below a target
 * and to compute the immediate cheaper tick (one step down).
 */
export function tickSizeFor(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0.0001;
  // Determine order of magnitude of the price
  const magnitude = Math.pow(
    10,
    Math.max(0, Math.floor(Math.log10(price)) - 3)
  );
  // Examples:
  // 1_000..9_999 => 1
  // 10_000..99_999 => 10
  // 100_000..999_999 => 100
  // 1_000_000..9_999_999 => 1_000
  return magnitude;
}

export function snapDownToTick(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const tick = tickSizeFor(price);
  return Math.floor(price / tick) * tick;
}

export function nextCheaperTick(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const tick = tickSizeFor(price);
  const snapped = snapDownToTick(price);
  // If already exactly on tick, step one tick down; else snapping down already made it strictly cheaper
  return snapped === price ? Math.max(0, snapped - tick) : snapped;
}
