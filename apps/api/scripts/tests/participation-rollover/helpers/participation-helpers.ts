/**
 * Participation Management Helper Functions
 * 
 * Provides utilities for creating participations, rollovers, and opt-outs.
 */

export interface CreateParticipationOptions {
  cycleId: string;
  characterName: string;
  amountIsk: string;
  testUserId?: string;
  rollover?: {
    type: 'FULL_PAYOUT' | 'INITIAL_ONLY' | 'CUSTOM_AMOUNT';
    customAmountIsk?: string;
  };
}

/**
 * Create a participation (opt-in to a cycle)
 */
export async function createParticipation(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  options: CreateParticipationOptions,
): Promise<any> {
  return await apiCall(
    'POST',
    `/ledger/cycles/${options.cycleId}/participations`,
    {
      characterName: options.characterName,
      amountIsk: options.amountIsk,
      testUserId: options.testUserId,
      rollover: options.rollover,
    },
  );
}

/**
 * Get all participations for a cycle
 */
export async function getParticipations(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<any[]> {
  return await apiCall('GET', `/ledger/cycles/${cycleId}/participations`, null);
}

// JingleYield-specific helpers live under scripts/tests/jingle-yield/helpers

/**
 * Opt out of a participation
 */
export async function optOutParticipation(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  participationId: string,
): Promise<void> {
  await apiCall('POST', `/ledger/participations/${participationId}/opt-out`, {});
}

/**
 * Get max participation amount for a user
 */
export async function getMaxParticipation(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  testUserId?: string,
): Promise<{ maxAmountIsk: string; maxAmountB: number }> {
  const query = testUserId ? `?testUserId=${testUserId}` : '';
  return await apiCall('GET', `/ledger/participations/max-amount${query}`, null);
}

