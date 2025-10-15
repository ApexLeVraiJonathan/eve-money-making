import { fetchWithAuth } from "@/lib/api-client";

// Helper to make typed API calls
const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(error || `API error: ${res.status}`);
    }
    return res.json();
  },
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
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const res = await fetchWithAuth(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(error || `API error: ${res.status}`);
    }
    return res.json();
  },
  async delete(endpoint: string): Promise<void> {
    const res = await fetchWithAuth(endpoint, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(error || `API error: ${res.status}`);
    }
  },
};

export type CycleLine = {
  id: string;
  cycleId: string;
  typeId: number;
  typeName: string;
  destinationStationId: number;
  destinationStationName: string;
  plannedUnits: number;
  unitsBought: number;
  buyCostIsk: string;
  unitsSold: number;
  salesGrossIsk: string;
  salesTaxIsk: string;
  salesNetIsk: string;
  brokerFeesIsk: string;
  relistFeesIsk: string;
  unitsRemaining: number;
  wacUnitCost: string;
  lineProfitExclTransport: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCycleLineRequest = {
  typeId: number;
  destinationStationId: number;
  plannedUnits: number;
};

export type UpdateCycleLineRequest = {
  plannedUnits?: number;
};

export async function listCycleLines(cycleId: string): Promise<CycleLine[]> {
  return apiClient.get<CycleLine[]>(`/ledger/cycles/${cycleId}/lines`);
}

export async function createCycleLine(
  cycleId: string,
  data: CreateCycleLineRequest,
): Promise<CycleLine> {
  return apiClient.post<CycleLine>(`/ledger/cycles/${cycleId}/lines`, data);
}

export async function updateCycleLine(
  lineId: string,
  data: UpdateCycleLineRequest,
): Promise<CycleLine> {
  return apiClient.patch<CycleLine>(`/ledger/lines/${lineId}`, data);
}

export async function deleteCycleLine(lineId: string): Promise<void> {
  return apiClient.delete(`/ledger/lines/${lineId}`);
}

export async function addBrokerFee(
  lineId: string,
  amountIsk: string,
): Promise<CycleLine> {
  return apiClient.post<CycleLine>(`/ledger/lines/${lineId}/broker-fee`, {
    amountIsk,
  });
}

export async function addRelistFee(
  lineId: string,
  amountIsk: string,
): Promise<CycleLine> {
  return apiClient.post<CycleLine>(`/ledger/lines/${lineId}/relist-fee`, {
    amountIsk,
  });
}

export type TransportFee = {
  id: string;
  cycleId: string;
  feeType: string;
  amountIsk: string;
  occurredAt: string;
  memo?: string;
  createdAt: string;
};

export async function addTransportFee(
  cycleId: string,
  amountIsk: string,
  memo?: string,
): Promise<TransportFee> {
  return apiClient.post<TransportFee>(
    `/ledger/cycles/${cycleId}/transport-fee`,
    { amountIsk, memo },
  );
}

export async function listTransportFees(
  cycleId: string,
): Promise<TransportFee[]> {
  return apiClient.get<TransportFee[]>(
    `/ledger/cycles/${cycleId}/transport-fees`,
  );
}

export type CycleProfit = {
  lineProfitExclTransport: string;
  transportFees: string;
  cycleProfitCash: string;
  lineBreakdown: Array<{
    lineId: string;
    typeId: number;
    typeName: string;
    destinationStationId: number;
    destinationStationName: string;
    profit: string;
  }>;
};

export async function getCycleProfit(cycleId: string): Promise<CycleProfit> {
  return apiClient.get<CycleProfit>(`/ledger/cycles/${cycleId}/profit`);
}

export type CycleSnapshot = {
  id: string;
  cycleId: string;
  snapshotAt: string;
  walletCashIsk: string;
  inventoryIsk: string;
  cycleProfitIsk: string;
  createdAt: string;
};

export async function getCycleSnapshots(
  cycleId: string,
): Promise<CycleSnapshot[]> {
  return apiClient.get<CycleSnapshot[]>(`/ledger/cycles/${cycleId}/snapshots`);
}

export async function createCycleSnapshot(
  cycleId: string,
): Promise<CycleSnapshot> {
  return apiClient.post<CycleSnapshot>(`/ledger/cycles/${cycleId}/snapshot`);
}
