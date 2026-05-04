import { headers } from "next/headers";
import { CycleDetailsContent } from "./_components/cycle-details-content";

type CurrentCycle = {
  id: string;
  name: string | null;
  endsAt: string | null;
  capital: {
    cashISK: number;
    inventoryISK: number;
    originalInvestmentISK: number;
  };
};

type CommitSummary = {
  id: string;
  name: string;
  openedAt: string;
  closedAt: string | null;
  totals: {
    investedISK: number;
    soldISK: number;
    estSellISK: number;
    estFeesISK: number;
    estProfitISK: number;
    estReturnPct: number;
  };
};

export default async function CycleDetailsPage() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const overviewRes = await fetch(
    `${base}/api/tradecraft/ledger/cycles/overview`,
    {
      cache: "no-store",
    },
  );
  const { current } = (await overviewRes.json()) as {
    current: CurrentCycle | null;
  };

  const commitsRes = current
    ? await fetch(
        `${base}/api/tradecraft/ledger/commits/summary?cycleId=${encodeURIComponent(current.id)}`,
        {
          next: { revalidate: 30 },
        },
      )
    : null;
  const commitsJson = commitsRes ? await commitsRes.json() : [];
  const commits = (
    Array.isArray(commitsJson) ? commitsJson : []
  ) as CommitSummary[];

  return <CycleDetailsContent current={current} commits={commits} />;
}
