/**
 * JingleYield Test Helpers
 *
 * Thin wrapper around the existing participation-rollover helpers,
 * plus JingleYield-specific helpers. This keeps JY tests logically
 * separated while still reusing shared test infrastructure.
 */

export type { TestConfig, SharedRolloverContext } from '../../participation-rollover/helpers';
export { createSharedContext, createApiCall, waitForUser } from '../../participation-rollover/helpers';

export {
  formatIsk,
  logStep,
  logSuccess,
  logWarning,
  printScenarioHeader,
  printScenarioComplete,
} from '../../participation-rollover/helpers';

export { cleanAllTestData } from '../../participation-rollover/helpers';

export { createCycle, openCycle, closeCycle } from '../../participation-rollover/helpers';

export {
  getParticipations,
  createPayouts,
} from '../../participation-rollover/helpers';

/**
 * Create a JingleYield participation for a user (admin-only endpoint)
 */
export async function createJingleYieldParticipation(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  options: {
    userId: string;
    cycleId: string;
    adminCharacterId: number;
    characterName: string;
    principalIsk?: string;
    minCycles?: number;
  },
): Promise<any> {
  return await apiCall('POST', `/ledger/jingle-yield/participations`, {
    userId: options.userId,
    cycleId: options.cycleId,
    adminCharacterId: options.adminCharacterId,
    characterName: options.characterName,
    ...(options.principalIsk ? { principalIsk: options.principalIsk } : {}),
    ...(typeof options.minCycles === 'number'
      ? { minCycles: options.minCycles }
      : {}),
  });
}


