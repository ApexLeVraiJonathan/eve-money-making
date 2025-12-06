/**
 * Participation Rollover Test Helpers
 *
 * Central export point for all helper functions.
 */

// Re-export all helpers
export * from './cycle-helpers';
export * from './participation-helpers';
export * from './transaction-helpers';
export * from './assertion-helpers';

// Common types
export interface TestConfig {
  apiUrl: string;
  token?: string;
  apiKey?: string;
  characterId: number;
  skipPauses?: boolean;
  interactive?: boolean;
  /**
   * Optional test user ID (used in some suites for investor-facing checks)
   */
  testUserId?: string;
}

export interface TestContext {
  config: TestConfig;
  characterId: number;
  transactionIdCounter: number;
}

/**
 * Shared context that is passed between scenarios in the suite
 * Allows scenarios to build on each other's state
 */
export interface SharedRolloverContext {
  /** Test user ID used consistently across scenarios */
  testUserId: string;

  /** Created cycle IDs in order */
  cycleIds: string[];

  /** Latest participation ID for the test user */
  latestParticipationId?: string;

  /** Current OPEN cycle ID */
  currentOpenCycleId?: string;

  /** Last known payout amount from a closed cycle */
  lastPayoutAmount?: number;

  /** Last known initial investment amount */
  lastInitialAmount?: number;

  /** Transaction counter for generating unique IDs */
  transactionIdCounter: number;

  /** Participation ID in Cycle 4 that will be rolled over (for Scenario 05) */
  cycle4ParticipationId?: string;
}

/**
 * Create API call function bound to config
 */
export function createApiCall(config: TestConfig) {
  return async (method: string, path: string, body?: any): Promise<any> => {
    const url = `${config.apiUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    } else if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    } else {
      throw new Error('Either --apiKey or --token must be provided');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `API call failed: ${response.status} ${response.statusText}\n${text}`,
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `API call timed out after 2 minutes: ${method} ${path}`,
        );
      }
      throw error;
    }
  };
}

/**
 * Wait for user to press ENTER (for interactive UI verification)
 */
export function waitForUser(
  config: TestConfig,
  message: string,
): Promise<void> {
  if (!config.interactive) {
    return Promise.resolve();
  }

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n⏸️  ${message}\n   Press ENTER to continue...`, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Create a shared rollover context for the test suite
 */
export function createSharedContext(testUserId: string): SharedRolloverContext {
  return {
    testUserId,
    cycleIds: [],
    transactionIdCounter: 0,
  };
}
