import {
  estimateNetForItem,
  feeAmount,
  type ImportedItem,
} from "./consignment-form-utils";

export function calculateTotalFees(items: ImportedItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.unitPrice > 0 ? feeAmount(item) : 0),
    0,
  );
}

export function calculateTotalNet(items: ImportedItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.unitPrice > 0 ? estimateNetForItem(item) : 0),
    0,
  );
}
