import { MOCK_CONSIGNMENTS, type Consignment } from "./data";

let CONSIGNMENTS: Consignment[] = [...MOCK_CONSIGNMENTS];

export const consignmentsQueryKey = ["consignments"] as const;

export async function listConsignments(): Promise<Consignment[]> {
  // Simulate small network latency
  await new Promise((r) => setTimeout(r, 150));
  return [...CONSIGNMENTS];
}

export async function createConsignment(
  newC: Consignment
): Promise<Consignment> {
  await new Promise((r) => setTimeout(r, 250));
  CONSIGNMENTS = [newC, ...CONSIGNMENTS];
  return newC;
}
