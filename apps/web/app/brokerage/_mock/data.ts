export type ConsignmentItem = {
  type_name: string;
  units: number;
  unitprice: number; // ISK per unit
  listing_strategy: string; // e.g., A/B/C/D/E for now
  unitsSold?: number; // sold units
  paidOutISK?: number; // money paid out so far
};

export type ConsignmentStatus = "awaiting-contract" | "active" | "closed";

export type Consignment = {
  id: string;
  title: string;
  createdAt: string;
  hub: "Jita 4-4" | "C-N";
  items: ConsignmentItem[];
  status: ConsignmentStatus;
};

export const MOCK_CONSIGNMENTS: Consignment[] = [
  {
    id: "C-1001",
    title: "Starter Modules Batch",
    createdAt: new Date().toISOString(),
    hub: "Jita 4-4",
    status: "active",
    items: [
      {
        type_name: "Caldari Navy Ballistic Control System",
        units: 4,
        unitprice: 4_895_46,
        listing_strategy: "C",
        unitsSold: 1,
        paidOutISK: 489_546,
      },
    ],
  },
  {
    id: "C-1002",
    title: "Blueprint Copies",
    createdAt: new Date().toISOString(),
    hub: "C-N",
    status: "awaiting-contract",
    items: [
      {
        type_name: "Heavy Missile Launcher II",
        units: 6,
        unitprice: 124_302,
        listing_strategy: "C",
        unitsSold: 0,
        paidOutISK: 0,
      },
    ],
  },
  {
    id: "C-1003",
    title: "Rigs and Subsystems",
    createdAt: new Date().toISOString(),
    hub: "Jita 4-4",
    status: "active",
    items: [
      {
        type_name: "Medium Core Defense Field Extender I",
        units: 20,
        unitprice: 900_000,
        listing_strategy: "D",
        unitsSold: 8,
        paidOutISK: 7_200_000,
      },
      {
        type_name: "Tengu Defensive - Amplification Node",
        units: 2,
        unitprice: 30_000_000,
        listing_strategy: "C",
        unitsSold: 1,
        paidOutISK: 28_500_000,
      },
    ],
  },
  {
    id: "C-1004",
    title: "Salvage Lot",
    createdAt: new Date().toISOString(),
    hub: "C-N",
    status: "closed",
    items: [
      {
        type_name: "Tripped Power Circuit",
        units: 100,
        unitprice: 45_000,
        listing_strategy: "B",
        unitsSold: 100,
        paidOutISK: 4_500_000,
      },
      {
        type_name: "Burned Logic Circuit",
        units: 60,
        unitprice: 120_000,
        listing_strategy: "B",
        unitsSold: 60,
        paidOutISK: 7_200_000,
      },
    ],
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
