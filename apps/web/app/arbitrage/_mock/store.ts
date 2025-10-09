import {
  MOCK_CURRENT_CYCLE,
  MOCK_NEXT_CYCLE,
  MOCK_PARTICIPATION_SELF,
  type ArbitrageCycle,
  type InvestorParticipation,
} from "./data";

export async function getCurrentCycle(): Promise<ArbitrageCycle> {
  await new Promise((r) => setTimeout(r, 120));
  return JSON.parse(JSON.stringify(MOCK_CURRENT_CYCLE));
}

export async function getNextCycle(): Promise<{
  id: string;
  name: string;
  startedAt: string;
  endsAt: string;
  status: "Planned" | "Open" | "Closed";
}> {
  await new Promise((r) => setTimeout(r, 80));
  return JSON.parse(JSON.stringify(MOCK_NEXT_CYCLE));
}

export async function getMyParticipation(): Promise<InvestorParticipation | null> {
  await new Promise((r) => setTimeout(r, 100));
  return JSON.parse(JSON.stringify(MOCK_PARTICIPATION_SELF));
}

export async function submitOptIn(
  amountISK: number,
  character: string,
): Promise<InvestorParticipation> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    characterName: character,
    amountISK,
    status: "Awaiting-Investment",
    memo: `ARB ${MOCK_NEXT_CYCLE.id} ${character}`,
    cycleId: MOCK_NEXT_CYCLE.id,
    // With a 10% cycle margin and 50% profit share, payout ≈ 5% of invested
    estimatedPayoutISK: Math.round(amountISK * 0.05),
  };
}
