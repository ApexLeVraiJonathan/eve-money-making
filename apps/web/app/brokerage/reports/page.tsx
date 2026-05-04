import {
  MOCK_CONSIGNMENTS,
  MOCK_DAILY_PAYOUTS,
  type Consignment,
} from "../_mock/data";
import { BrokerageReportsContent } from "./_components/brokerage-reports-content";

export default function BrokerageReportsPage() {
  const consignments: Consignment[] = MOCK_CONSIGNMENTS;
  const statusCounts = consignments.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const listedValue = consignments.reduce((sum, c) => {
    // Sum of units * unitprice for items in selling/awaiting states
    const include =
      c.status === "Selling" ||
      c.status === "Awaiting-Contract" ||
      c.status === "Awaiting-Validation";
    if (!include) return sum;
    const itemsTotal = c.items.reduce(
      (s, it) => s + it.units * it.unitprice,
      0,
    );
    return sum + itemsTotal;
  }, 0);

  const realizedISK = consignments.reduce((sum, c) => {
    return sum + c.items.reduce((s, it) => s + (it.paidOutISK ?? 0), 0);
  }, 0);

  const outstandingISK = Math.max(0, listedValue - realizedISK);

  const byWeek = groupByWeek(
    MOCK_DAILY_PAYOUTS.map((d) => ({ date: d.date, amount: d.amount })),
  );

  return (
    <BrokerageReportsContent
      consignments={consignments}
      dailyPayouts={MOCK_DAILY_PAYOUTS}
      listedValue={listedValue}
      realizedISK={realizedISK}
      outstandingISK={outstandingISK}
      statusCounts={statusCounts}
      weeklyPayouts={byWeek}
    />
  );
}

function groupByWeek(dailies: { date: string; amount: number }[]) {
  const weeks = new Map<string, number>();
  for (const { date, amount } of dailies) {
    const d = new Date(date);
    // ISO week number (YYYY-Www)
    const week = isoWeekKey(d);
    weeks.set(week, (weeks.get(week) ?? 0) + amount);
  }
  return Array.from(weeks.entries()).map(([week, total]) => ({ week, total }));
}

function isoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}
