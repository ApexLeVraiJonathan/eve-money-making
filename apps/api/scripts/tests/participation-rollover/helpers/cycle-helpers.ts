/**
 * Cycle Management Helper Functions
 * 
 * Provides utilities for creating, opening, and managing cycles in tests.
 */

/**
 * Create a new planned cycle
 */
export async function createCycle(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  name: string,
  startedAt?: Date,
): Promise<{ id: string; name: string }> {
  const cycle = await apiCall('POST', '/ledger/cycles/plan', {
    startedAt: (startedAt || new Date(Date.now() + 5000)).toISOString(),
    name,
  });
  return cycle;
}

/**
 * Open a planned cycle (which auto-closes the previous OPEN cycle if exists)
 */
export async function openCycle(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<void> {
  await apiCall('POST', `/ledger/cycles/${cycleId}/open`, {});
}

/**
 * Manually close a cycle with final settlement
 */
export async function closeCycle(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<void> {
  await apiCall('POST', `/ledger/cycles/${cycleId}/close`, {});
}

/**
 * Get cycle overview (current cycle info, profit, etc.)
 */
export async function getCycleOverview(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
): Promise<any> {
  return await apiCall('GET', '/ledger/cycles/overview', null);
}

/**
 * Get cycle lines (inventory items)
 */
export async function getCycleLines(
  apiCall: (method: string, path: string, body?: any) => Promise<any>,
  cycleId: string,
): Promise<any[]> {
  return await apiCall('GET', `/ledger/cycles/${cycleId}/lines`, null);
}

