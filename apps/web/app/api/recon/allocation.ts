import { fetchWithAuth } from "@/lib/api-client";

// Helper to make typed API calls
const apiClient = {
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const res = await fetchWithAuth(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(error || `API error: ${res.status}`);
    }
    return res.json();
  },
};

export type AllocationResult = {
  buysAllocated: number;
  sellsAllocated: number;
  unmatchedBuys: number;
  unmatchedSells: number;
};

export async function runAllocation(
  cycleId?: string,
): Promise<AllocationResult> {
  const url = cycleId
    ? `/recon/reconcile?cycleId=${cycleId}`
    : "/recon/reconcile";
  return apiClient.post<AllocationResult>(url);
}
