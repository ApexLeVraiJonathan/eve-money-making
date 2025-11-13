/**
 * Assertion and Formatting Helper Functions
 * 
 * Provides utilities for assertions, formatting, and validation.
 */

/**
 * Format ISK amount for display
 */
export function formatIsk(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Assert approximately equal (for ISK amounts with rounding)
 */
export function assertApproxEqual(
  actual: number,
  expected: number,
  tolerance: number = 0.01,
  message?: string,
): void {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      message ||
        `Expected ${formatIsk(expected)}, got ${formatIsk(actual)} (diff: ${formatIsk(diff)})`,
    );
  }
}

/**
 * Assert value is within range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string,
): void {
  if (value < min || value > max) {
    throw new Error(
      message ||
        `Expected value between ${formatIsk(min)} and ${formatIsk(max)}, got ${formatIsk(value)}`,
    );
  }
}

/**
 * Log test step
 */
export function logStep(step: string, message: string): void {
  console.log(`\n${step}  ${message}`);
}

/**
 * Log success
 */
export function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`);
}

/**
 * Log warning
 */
export function logWarning(message: string): void {
  console.log(`  ⚠️  ${message}`);
}

/**
 * Log info
 */
export function logInfo(message: string): void {
  console.log(`  ℹ️  ${message}`);
}

/**
 * Log API call
 */
export function logApiCall(method: string, path: string): void {
  console.log(`[API] ${method} ${path}`);
}

/**
 * Print scenario header
 */
export function printScenarioHeader(emoji: string, title: string): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${emoji} ${title}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Print scenario complete
 */
export function printScenarioComplete(): void {
  console.log('\n✅ SCENARIO COMPLETE\n');
}

