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
}

export interface TestContext {
  config: TestConfig;
  characterId: number;
  transactionIdCounter: number;
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
        throw new Error(`API call timed out after 2 minutes: ${method} ${path}`);
      }
      throw error;
    }
  };
}

