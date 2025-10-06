export type Consignment = {
  id: string;
  title: string;
  createdAt: string;
  hub: "Jita 4-4" | "C-N";
  strategy:
    | "Client fixed price"
    | "Cheapest (no repricing)"
    | "Cheapest + daily"
    | "Cheapest + 2x daily"
    | "Cheapest + 3x daily";
  feePercent: number;
  estimatedValue: number; // ISK
  realizedValue: number; // ISK
  leftToSell: number; // ISK
};

export const MOCK_CONSIGNMENTS: Consignment[] = [
  {
    id: "C-1001",
    title: "Starter Modules Batch",
    createdAt: new Date().toISOString(),
    hub: "Jita 4-4",
    strategy: "Cheapest + daily",
    feePercent: 3,
    estimatedValue: 520_000_000,
    realizedValue: 210_000_000,
    leftToSell: 310_000_000,
  },
  {
    id: "C-1002",
    title: "Blueprint Copies",
    createdAt: new Date().toISOString(),
    hub: "C-N",
    strategy: "Cheapest (no repricing)",
    feePercent: 2.5,
    estimatedValue: 1_200_000_000,
    realizedValue: 0,
    leftToSell: 1_200_000_000,
  },
];

export function formatISK(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ISK",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("ISK", "ISK");
}

export type DailyPayout = {
  date: string; // YYYY-MM-DD
  amount: number; // ISK
};

export const MOCK_DAILY_PAYOUTS: DailyPayout[] = [
  {
    date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10),
    amount: 120_000_000,
  },
  {
    date: new Date(Date.now() - 1 * 864e5).toISOString().slice(0, 10),
    amount: 85_000_000,
  },
  { date: new Date().toISOString().slice(0, 10), amount: 145_000_000 },
];
