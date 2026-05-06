import { eveClientStringCompare } from "@/lib/eve-sort";
import type { UndercutCheckGroup } from "@eve/shared/tradecraft-pricing";
import { getProfitCategory } from "./profit";
import type { GroupToRender } from "./types";

export type CycleLineLite = {
  id: string;
  typeId: string | number;
  destinationStationId: string | number;
};

export type SelectionReader = {
  get: (key: string) => boolean;
};

export function parseResolvedStructureId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

export function getSelectionKey(
  characterId: number,
  stationId: number,
  orderId: number,
): string {
  return `${characterId}:${stationId}:${orderId}`;
}

export function buildInitialSelectionState(
  groups: UndercutCheckGroup[],
): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  for (const group of groups) {
    for (const update of group.updates) {
      initial[getSelectionKey(group.characterId, group.stationId, update.orderId)] =
        getProfitCategory(update.estimatedMarginPercentAfter) !== "red";
    }
  }
  return initial;
}

export function buildGroupsToRender(
  result: UndercutCheckGroup[] | null,
  showNegativeProfit: boolean,
): GroupToRender[] {
  if (!Array.isArray(result) || result.length === 0) return [];
  return result.map((group) => {
    const updates = group.updates
      .filter((update) => {
        const category = getProfitCategory(update.estimatedMarginPercentAfter);
        return showNegativeProfit || category !== "red";
      })
      .toSorted((a, b) => {
        const byItem = eveClientStringCompare(a.itemName, b.itemName);
        if (byItem !== 0) return byItem;
        if (a.remaining !== b.remaining) return b.remaining - a.remaining;
        if (a.currentPrice !== b.currentPrice) return b.currentPrice - a.currentPrice;
        return b.orderId - a.orderId;
      });
    return { group, updates };
  });
}

export function getPreferredCycleId(
  latestCycles: Array<{ id: string; status: string }>,
): string | null {
  if (latestCycles.length === 0) return null;
  const openCycle = latestCycles.find((cycle) => cycle.status === "OPEN");
  return openCycle ? openCycle.id : latestCycles[0].id;
}

export function buildConfirmRepricePayload(params: {
  result: UndercutCheckGroup[];
  cycleLines: CycleLineLite[];
  selection: SelectionReader;
  relistPct: number;
}): {
  errors: string[];
  relistFees: Array<{ lineId: string; amountIsk: string }>;
  priceUpdates: Array<{ lineId: string; currentSellPriceIsk: string }>;
} {
  const { result, cycleLines, selection, relistPct } = params;
  const errors: string[] = [];
  const relistFees: Array<{ lineId: string; amountIsk: string }> = [];
  const priceUpdates: Array<{ lineId: string; currentSellPriceIsk: string }> = [];

  for (const group of result) {
    for (const update of group.updates) {
      const key = getSelectionKey(group.characterId, group.stationId, update.orderId);
      if (!selection.get(key)) continue;

      const line = cycleLines.find(
        (candidate) =>
          Number(candidate.typeId) === Number(update.typeId) &&
          Number(candidate.destinationStationId) === Number(group.stationId),
      );

      if (!line) {
        errors.push(
          `Could not find cycle line for ${update.itemName} (typeId: ${update.typeId}, stationId: ${group.stationId})`,
        );
        continue;
      }

      const total = update.remaining * update.suggestedNewPriceTicked;
      const feeAmount = (total * (relistPct / 100)).toFixed(2);
      relistFees.push({ lineId: line.id, amountIsk: feeAmount });
      priceUpdates.push({
        lineId: line.id,
        currentSellPriceIsk: update.suggestedNewPriceTicked.toFixed(2),
      });
    }
  }

  return { errors, relistFees, priceUpdates };
}
