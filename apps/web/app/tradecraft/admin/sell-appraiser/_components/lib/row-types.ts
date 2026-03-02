import type {
  SellAppraiseByCommitItem,
  SellAppraiseItem,
} from "@eve/shared/tradecraft-pricing";

export type PasteRow = SellAppraiseItem;
export type CommitRow = SellAppraiseByCommitItem;
export type SellAppraiserRow = PasteRow | CommitRow;

export type GroupedResult = {
  destinationStationId: number;
  stationName: string;
  items: SellAppraiserRow[];
};

export function isCommitRow(row: SellAppraiserRow): row is CommitRow {
  return (row as CommitRow).typeId !== undefined && "quantityRemaining" in row;
}
