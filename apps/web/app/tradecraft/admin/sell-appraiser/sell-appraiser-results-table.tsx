"use client";

import * as React from "react";
import type { ColumnDef } from "@eve/ui";
import { Check, Copy } from "lucide-react";

import {
  Checkbox,
  DataTable,
  DataTableColumnHeader,
  TableCell,
  TableFooter,
  TableRow,
} from "@eve/ui";
import { formatIsk } from "@/lib/utils";
import type {
  SellAppraiseItem,
  SellAppraiseByCommitItem,
} from "@eve/shared/types";

type PasteRow = SellAppraiseItem;
type CommitRow = SellAppraiseByCommitItem;
type SellAppraiserRow = PasteRow | CommitRow;

function isCommitRow(row: SellAppraiserRow): row is CommitRow {
  return (row as CommitRow).typeId !== undefined && "quantityRemaining" in row;
}

export type SelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  get: (key: string) => boolean;
  toggle: (key: string) => void;
  setMany: (keys: string[], checked: boolean) => void;
};

type TableRowData = SellAppraiserRow & {
  __key: string;
  __qty: number;
};

const itemNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function itemNameSortKey(name: string): string {
  return name
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/^[^0-9A-Za-z]+/u, "");
}

const RowSelectCheckbox = React.memo(function RowSelectCheckbox({
  selectionStore,
  rowKey,
}: {
  selectionStore: SelectionStore;
  rowKey: string;
}) {
  const checked = React.useSyncExternalStore(
    selectionStore.subscribe,
    () => selectionStore.get(rowKey),
    () => selectionStore.get(rowKey),
  );

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => selectionStore.toggle(rowKey)}
      aria-label="Select row"
    />
  );
});

const HeaderSelectAllCheckbox = React.memo(function HeaderSelectAllCheckbox({
  selectionStore,
  rowKeys,
}: {
  selectionStore: SelectionStore;
  rowKeys: string[];
}) {
  React.useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getVersion,
    selectionStore.getVersion,
  );

  const allSelected =
    rowKeys.length > 0 && rowKeys.every((k) => selectionStore.get(k));
  const someSelected = rowKeys.some((k) => selectionStore.get(k));

  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={(checked) => {
        const nextChecked = checked === true;
        selectionStore.setMany(rowKeys, nextChecked);
      }}
      aria-label="Select all"
    />
  );
});

const SellAppraiserFooter = React.memo(function SellAppraiserFooter({
  selectionStore,
  rows,
  brokerFeePct,
}: {
  selectionStore: SelectionStore;
  rows: TableRowData[];
  brokerFeePct: number;
}) {
  React.useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getVersion,
    selectionStore.getVersion,
  );

  const total = rows.reduce((sum, r) => {
    if (!selectionStore.get(r.__key)) return sum;
    if (!isCommitRow(r)) return sum;
    if (r.suggestedSellPriceTicked === null) return sum;
    return sum + r.__qty * r.suggestedSellPriceTicked * (brokerFeePct / 100);
  }, 0);

  return (
    <TableFooter>
      <TableRow>
        <TableCell />
        <TableCell colSpan={2} className="text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium">Total broker fee (selected):</span>
            <span className="font-semibold tabular-nums whitespace-nowrap">
              {formatIsk(total)}
            </span>
          </div>
        </TableCell>
        <TableCell colSpan={3} />
      </TableRow>
    </TableFooter>
  );
});

export type SellAppraiserResultsTableProps = {
  items: SellAppraiserRow[];
  selectionStore: SelectionStore;
  copiedKey: string | null;
  onCopySuggestedPrice: (price: number, key: string) => void;
  isCommitMode: boolean;
  brokerFeePct: number;
};

export function SellAppraiserResultsTable({
  items,
  selectionStore,
  copiedKey,
  onCopySuggestedPrice,
  isCommitMode,
  brokerFeePct,
}: SellAppraiserResultsTableProps) {
  const rows = React.useMemo<TableRowData[]>(
    () =>
      items.map((r) => {
        const key = `${r.destinationStationId}:${isCommitRow(r) ? r.typeId : r.itemName}`;
        const qty = isCommitRow(r) ? r.quantityRemaining : r.quantity;
        return { ...r, __key: key, __qty: qty };
      }),
    [items],
  );

  const rowKeys = React.useMemo(() => rows.map((r) => r.__key), [rows]);

  const columns = React.useMemo<ColumnDef<TableRowData, unknown>[]>(() => {
    const cols: Array<ColumnDef<TableRowData, unknown>> = [
      {
        id: "select",
        header: () => (
          <div className="flex items-center justify-center w-10">
            <HeaderSelectAllCheckbox
              selectionStore={selectionStore}
              rowKeys={rowKeys}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-10">
            <RowSelectCheckbox
              selectionStore={selectionStore}
              rowKey={row.original.__key}
            />
          </div>
        ),
        enableSorting: false,
        meta: {
          headerClassName: "w-12",
          cellClassName: "w-12",
        },
      },
      {
        id: "suggested",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Suggested"
            className="w-full justify-start"
          />
        ),
        accessorFn: (r) => r.suggestedSellPriceTicked,
        cell: ({ row }) => {
          const suggested = row.original.suggestedSellPriceTicked;
          const key = row.original.__key;
          return (
            <div className="flex items-center gap-2">
              {suggested !== null ? (
                <button
                  type="button"
                  onClick={() => onCopySuggestedPrice(suggested, key)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Copy suggested price"
                  aria-label="Copy suggested price"
                >
                  {copiedKey === key ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
              <span className="font-medium tabular-nums whitespace-nowrap">
                {formatIsk(suggested)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        meta: {
          headerClassName: "w-[220px]",
          cellClassName: "w-[220px]",
        },
      },
      {
        accessorKey: "itemName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Item"
            className="w-full justify-start"
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-0 font-medium truncate">
            {row.original.itemName}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB, columnId) => {
          const a = String(rowA.getValue(columnId) ?? "");
          const b = String(rowB.getValue(columnId) ?? "");
          return itemNameCollator.compare(
            itemNameSortKey(a),
            itemNameSortKey(b),
          );
        },
        meta: {
          headerClassName: "w-[420px] min-w-0",
          cellClassName: "w-[420px] min-w-0",
        },
      },
      {
        id: "qty",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Qty"
            className="w-full justify-start"
          />
        ),
        accessorFn: (r) => r.__qty,
        cell: ({ row }) => (
          <div className="text-left tabular-nums whitespace-nowrap">
            {row.original.__qty}
          </div>
        ),
        enableSorting: true,
        meta: {
          headerClassName: "w-[90px]",
          cellClassName: "w-[90px]",
        },
      },
      {
        id: "lowestSell",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Lowest Sell"
            className="w-full justify-start"
          />
        ),
        accessorFn: (r) => r.lowestSell,
        cell: ({ row }) => (
          <div className="text-left tabular-nums whitespace-nowrap">
            {formatIsk(row.original.lowestSell)}
          </div>
        ),
        enableSorting: true,
        meta: {
          headerClassName: "w-[160px]",
          cellClassName: "w-[160px]",
        },
      },
    ];

    if (isCommitMode) {
      cols.push({
        id: "brokerFee",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={`Broker Fee (${brokerFeePct}%)`}
            className="w-full justify-start"
          />
        ),
        accessorFn: (r) => {
          if (!isCommitRow(r)) return null;
          if (r.suggestedSellPriceTicked === null) return null;
          return r.__qty * r.suggestedSellPriceTicked * (brokerFeePct / 100);
        },
        cell: ({ row }) => {
          const r = row.original;
          if (!isCommitRow(r)) return <div className="text-left">-</div>;
          if (r.suggestedSellPriceTicked === null)
            return <div className="text-left">-</div>;
          return (
            <div className="font-medium text-left tabular-nums whitespace-nowrap">
              {formatIsk(
                r.__qty * r.suggestedSellPriceTicked * (brokerFeePct / 100),
              )}
            </div>
          );
        },
        enableSorting: true,
        meta: {
          headerClassName: "w-[200px]",
          cellClassName: "w-[200px]",
        },
      });
    }

    return cols;
  }, [
    brokerFeePct,
    copiedKey,
    isCommitMode,
    onCopySuggestedPrice,
    rowKeys,
    selectionStore,
  ]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(r) => r.__key}
      containerClassName="overflow-x-auto"
      tableClassName="table-fixed min-w-[760px]"
      initialSorting={[{ id: "itemName", desc: false }]}
      emptyState="No results."
      footer={
        isCommitMode ? (
          <SellAppraiserFooter
            selectionStore={selectionStore}
            rows={rows}
            brokerFeePct={brokerFeePct}
          />
        ) : null
      }
    />
  );
}
