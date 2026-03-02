import { eveClientStringCompare } from "@/lib/eve-sort";
import { sortByStationName } from "@/app/tradecraft/lib/station-sorting";
import { isCommitRow, type GroupedResult, type SellAppraiserRow } from "./row-types";

type DestinationLabel = (stationId: number) => string;

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

export function groupSellAppraiserResults(
  result: SellAppraiserRow[] | null,
  destinationLabel: DestinationLabel,
): GroupedResult[] {
  if (!result) return [];
  const groupMap = new Map<number, SellAppraiserRow[]>();
  for (const row of result) {
    const list = groupMap.get(row.destinationStationId) ?? [];
    list.push(row);
    groupMap.set(row.destinationStationId, list);
  }

  const groups: GroupedResult[] = [];
  for (const [destinationStationId, items] of groupMap) {
    groups.push({
      destinationStationId,
      stationName: destinationLabel(destinationStationId),
      items: [...items].sort((a, b) => eveClientStringCompare(a.itemName, b.itemName)),
    });
  }

  return sortByStationName(groups);
}

export function buildInitialSelectionState(
  rows: SellAppraiserRow[],
  useCommit: boolean,
): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  for (const row of rows) {
    const key = useCommit
      ? `${row.destinationStationId}:${isCommitRow(row) ? row.typeId : row.itemName}`
      : `${row.destinationStationId}:${row.itemName}`;
    initial[key] = true;
  }
  return initial;
}

export function buildConfirmListedPayload(params: {
  result: SellAppraiserRow[];
  cycleLines: CycleLineLite[];
  selection: SelectionReader;
  brokerFeePct: number;
}): {
  errors: string[];
  brokerFees: Array<{ lineId: string; amountIsk: string }>;
  priceUpdates: Array<{ lineId: string; currentSellPriceIsk: string; quantity: number }>;
} {
  const { result, cycleLines, selection, brokerFeePct } = params;
  const errors: string[] = [];
  const brokerFees: Array<{ lineId: string; amountIsk: string }> = [];
  const priceUpdates: Array<{
    lineId: string;
    currentSellPriceIsk: string;
    quantity: number;
  }> = [];

  for (const row of result) {
    const key = `${row.destinationStationId}:${isCommitRow(row) ? row.typeId : row.itemName}`;
    if (!selection.get(key)) continue;
    if (!isCommitRow(row)) continue;
    if (row.suggestedSellPriceTicked === null) {
      errors.push(`${row.itemName}: No suggested price available (skipped)`);
      continue;
    }

    const line = cycleLines.find(
      (candidate) =>
        Number(candidate.typeId) === Number(row.typeId) &&
        Number(candidate.destinationStationId) === Number(row.destinationStationId),
    );

    if (!line) {
      errors.push(
        `Could not find cycle line for ${row.itemName} (typeId: ${row.typeId}, stationId: ${row.destinationStationId})`,
      );
      continue;
    }

    const total = row.quantityRemaining * row.suggestedSellPriceTicked;
    const feeAmount = (total * (brokerFeePct / 100)).toFixed(2);
    brokerFees.push({
      lineId: line.id,
      amountIsk: feeAmount,
    });
    priceUpdates.push({
      lineId: line.id,
      currentSellPriceIsk: row.suggestedSellPriceTicked.toFixed(2),
      quantity: row.quantityRemaining,
    });
  }

  return { errors, brokerFees, priceUpdates };
}
