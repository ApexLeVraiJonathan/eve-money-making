import { formatIsk } from "@/lib/utils";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";
import { CircleHelp } from "lucide-react";

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

export function CycleDetailsContent({
  current,
  commits,
}: {
  current: CurrentCycle | null;
  commits: CommitSummary[];
}) {
  if (!current) return <NoCurrentCycle />;

  const cycleName = current.name ?? current.id;
  const endsAt = current.endsAt
    ? new Date(current.endsAt).toLocaleString()
    : "TBD";

  return (
    <div className="space-y-6 p-6">
      <PageHeader cycleName={cycleName} endsAt={endsAt} />
      <CapitalSection current={current} />
      <CommitsSection commits={commits} />
    </div>
  );
}

function NoCurrentCycle() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cycle details</h1>
      <section className="surface-1 rounded-lg border p-4">
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelp className="size-6" />
            </EmptyMedia>
            <EmptyTitle>No current cycle</EmptyTitle>
            <EmptyDescription>
              There is not an open cycle right now. Please check back later.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    </div>
  );
}

function PageHeader({
  cycleName,
  endsAt,
}: {
  cycleName: string;
  endsAt: string;
}) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Cycle details</h1>
      <div className="text-sm text-muted-foreground">
        {cycleName} • Ends {endsAt}
      </div>
    </header>
  );
}

function CapitalSection({ current }: { current: CurrentCycle }) {
  return (
    <section className="surface-1 rounded-lg border p-4">
      <h2 className="text-base font-medium">Capital</h2>
      <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
        <div>
          Original Investment:{" "}
          {formatIsk(current.capital.originalInvestmentISK)}
        </div>
        <div>Cash: {formatIsk(current.capital.cashISK)}</div>
        <div>Inventory: {formatIsk(current.capital.inventoryISK)}</div>
      </div>
    </section>
  );
}

function CommitsSection({ commits }: { commits: CommitSummary[] }) {
  return (
    <section className="surface-1 rounded-lg border p-4">
      <h2 className="text-base font-medium">Commits</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Opened</th>
              <th className="p-2">Closed</th>
              <th className="p-2">Invested</th>
              <th className="p-2">Sold</th>
              <th className="p-2">Est. Sell</th>
              <th className="p-2">Est. Fees</th>
              <th className="p-2">Est. Profit</th>
              <th className="p-2">Est. Return</th>
            </tr>
          </thead>
          <tbody>
            {commits.map((commit) => (
              <CommitRow key={commit.id} commit={commit} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommitRow({ commit }: { commit: CommitSummary }) {
  const profitClass =
    commit.totals.estProfitISK < 0 ? "text-red-400" : "text-emerald-500";
  const returnClass =
    commit.totals.estReturnPct < 0 ? "text-red-400" : "text-emerald-500";

  return (
    <tr className="border-t">
      <td className="p-2">{commit.name}</td>
      <td className="p-2">{new Date(commit.openedAt).toLocaleString()}</td>
      <td className="p-2">
        {commit.closedAt ? new Date(commit.closedAt).toLocaleString() : "Open"}
      </td>
      <td className="p-2">{formatIsk(commit.totals.investedISK)}</td>
      <td className="p-2 text-emerald-500">
        {formatIsk(commit.totals.soldISK)}
      </td>
      <td className="p-2 text-yellow-500">
        {formatIsk(commit.totals.estSellISK)}
      </td>
      <td className="p-2 text-red-400">
        {formatIsk(commit.totals.estFeesISK)}
      </td>
      <td className={`p-2 ${profitClass}`}>
        {formatIsk(commit.totals.estProfitISK)}
      </td>
      <td className={`p-2 ${returnClass}`}>
        {(commit.totals.estReturnPct * 100).toFixed(1)}%
      </td>
    </tr>
  );
}
