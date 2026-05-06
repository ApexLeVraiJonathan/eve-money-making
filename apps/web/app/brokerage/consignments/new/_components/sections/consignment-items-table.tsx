import {
  Input,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import {
  estimateNetForItem,
  feeAmount,
  STRATEGIES,
  totalFeePercent,
  type ImportedItem,
} from "../lib/consignment-form-utils";
import { calculateTotalFees, calculateTotalNet } from "../lib/item-totals";

type ConsignmentItemsTableProps = {
  items: ImportedItem[];
  onUnitPriceChange: (index: number, value: string) => void;
  onStrategyCodeChange: (index: number, strategyCode: string) => void;
};

export function ConsignmentItemsTable({
  items,
  onUnitPriceChange,
  onStrategyCodeChange,
}: ConsignmentItemsTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-md border p-4 surface-1 md:col-span-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Name</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">Unit price (ISK)</TableHead>
            <TableHead>Listing strategy</TableHead>
            <TableHead className="text-right">Fees (ISK)</TableHead>
            <TableHead className="text-right">Est. net (ISK)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No items yet. Import a list to get started.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, idx) => (
              <TableRow key={`${item.name}-${idx}`}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                </TableCell>
                <TableCell className="text-right">
                  {item.units.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    className="h-8 w-32 text-right"
                    value={item.unitPrice ? item.unitPrice : ""}
                    onChange={(e) => onUnitPriceChange(idx, e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <select
                    className="h-8 rounded-md border bg-transparent px-2"
                    value={item.strategyCode}
                    onChange={(e) => onStrategyCodeChange(idx, e.target.value)}
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="text-right text-yellow-500">
                  {item.unitPrice > 0
                    ? `${feeAmount(item).toLocaleString()} (${totalFeePercent(item).toFixed(2)}%)`
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-emerald-500">
                  {item.unitPrice > 0
                    ? estimateNetForItem(item).toLocaleString()
                    : "—"}{" "}
                  ISK
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {items.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-medium text-yellow-500">
                {calculateTotalFees(items).toLocaleString()} ISK
              </TableCell>
              <TableCell className="text-right font-medium text-emerald-500">
                {calculateTotalNet(items).toLocaleString()} ISK
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
