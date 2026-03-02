export const HUBS = ["Jita 4-4", "C-N"] as const;

export const STRATEGIES = [
  {
    code: "A",
    label: "Client fixed price",
    fee: 2,
    help: "You set a fixed price; no updates.",
  },
  {
    code: "B",
    label: "Cheapest sell order (no updates)",
    fee: 2.5,
    help: "List at current cheapest sell, never reprice.",
  },
  {
    code: "C",
    label: "Cheapest sell order (updates 1x/day)",
    fee: 3,
    help: "Reprice to cheapest once per day.",
  },
  {
    code: "D",
    label: "Cheapest sell order (updates 2x/day)",
    fee: 3.5,
    help: "Reprice to cheapest twice per day.",
  },
  {
    code: "E",
    label: "Cheapest sell order (updates 3x/day)",
    fee: 4,
    help: "Reprice to cheapest three times per day.",
  },
] as const;

export type Strategy = (typeof STRATEGIES)[number];
export type Hub = (typeof HUBS)[number];

export type ImportedItem = {
  name: string;
  units: number;
  unitPrice: number;
  strategyCode: string;
};

const SALES_TAX_PCT = 3.37;
const BROKER_FEE_PCT = 1.5;

export function mapHubToRecipient(hub: Hub): string {
  return hub === "Jita 4-4" ? "LeVraiTrader" : "LeVraiMindTrader05";
}

export function generateCode(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomUnitPrice(): number {
  const min = 100_000;
  const max = 500_000;
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function estimateNetForItem(item: ImportedItem): number {
  const gross = item.units * item.unitPrice;
  const s =
    STRATEGIES.find((strategy) => strategy.code === item.strategyCode) ??
    STRATEGIES[0];
  const totalFeePct = SALES_TAX_PCT + BROKER_FEE_PCT + s.fee;
  return Math.max(0, Math.floor(gross * (1 - totalFeePct / 100)));
}

export function totalFeePercent(item: ImportedItem): number {
  const s =
    STRATEGIES.find((strategy) => strategy.code === item.strategyCode) ??
    STRATEGIES[0];
  return SALES_TAX_PCT + BROKER_FEE_PCT + s.fee;
}

export function feeAmount(item: ImportedItem): number {
  const gross = item.units * item.unitPrice;
  return Math.max(0, Math.floor(gross * (totalFeePercent(item) / 100)));
}

export function parseImportedItemsFromText(
  input: string,
  strategyCode: string,
): ImportedItem[] {
  const parsed: ImportedItem[] = [];

  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const columns = line.split(/\t+/);
      if (columns.length >= 2) {
        const name = columns[0].trim();
        const qty = Number(columns[1].replace(/[,]/g, ""));
        if (name && Number.isFinite(qty)) {
          parsed.push({
            name,
            units: Math.max(0, Math.floor(qty)),
            unitPrice: randomUnitPrice(),
            strategyCode,
          });
          return;
        }
      }

      const parts = line.split(/\s{2,}/).filter(Boolean);
      if (parts.length >= 2) {
        const qty = Number(parts[parts.length - 1].replace(/[,]/g, ""));
        const name = parts.slice(0, parts.length - 1).join(" ");
        if (name && Number.isFinite(qty)) {
          parsed.push({
            name,
            units: Math.max(0, Math.floor(qty)),
            unitPrice: randomUnitPrice(),
            strategyCode,
          });
        }
      }
    });

  return parsed;
}
