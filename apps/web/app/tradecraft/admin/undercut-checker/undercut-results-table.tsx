"use client";

import * as React from "react";
import type { ColumnDef, Row } from "@eve/ui";
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
import { eveClientStringCompare } from "@/lib/eve-sort";
import type { UndercutCheckGroup } from "@eve/shared/types";

type ProfitCategory = "red" | "yellow" | "normal";

function getProfitCategory(marginPercent: number | undefined): ProfitCategory {
  if (marginPercent === undefined) return "normal";
  if (marginPercent <= -10) return "red";
  if (marginPercent < 0) return "yellow";
  return "normal";
}

type UpdateRow = UndercutCheckGroup["updates"][number] & {
  __key: string;
};

type SelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  get: (key: string) => boolean;
  toggle: (key: string) => void;
  setMany: (keys: string[], checked: boolean) => void;
};

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

const UndercutResultsFooter = React.memo(function UndercutResultsFooter({
  selectionStore,
  rows,
  relistPct,
}: {
  selectionStore: SelectionStore;
  rows: UpdateRow[];
  relistPct: number;
}) {
  React.useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.getVersion,
    selectionStore.getVersion,
  );

  const total = rows.reduce((sum, u) => {
    if (!selectionStore.get(u.__key)) return sum;
    return sum + u.remaining * u.suggestedNewPriceTicked * (relistPct / 100);
  }, 0);

  return (
    <TableFooter>
      <TableRow>
        <TableCell />
        <TableCell colSpan={2} className="text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium">Total relist fee (selected):</span>
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

export type UndercutResultsTableProps = {
  group: UndercutCheckGroup;
  updates: UndercutCheckGroup["updates"];
  selectionStore: SelectionStore;
  copiedKey: string | null;
  onCopyPrice: (price: number, key: string) => void;
  relistPct: number;
};

export function UndercutResultsTable({
  group,
  updates,
  selectionStore,
  copiedKey,
  onCopyPrice,
  relistPct,
}: UndercutResultsTableProps) {
  const rows = React.useMemo<UpdateRow[]>(
    () =>
      updates.map((u) => ({
        ...u,
        __key: `${group.characterId}:${group.stationId}:${u.orderId}`,
      })),
    [group.characterId, group.stationId, updates],
  );

  const rowKeys = React.useMemo(() => rows.map((r) => r.__key), [rows]);

  const columns = React.useMemo<ColumnDef<UpdateRow, unknown>[]>(
    () => [
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
        id: "current",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Current"
            className="w-full justify-start"
          />
        ),
        accessorFn: (row) => row.currentPrice,
        size: 220,
        cell: ({ row }) => {
          const u = row.original;
          const key = u.__key;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCopyPrice(u.suggestedNewPriceTicked, key)}
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
              <span className="text-left tabular-nums whitespace-nowrap">
                {formatIsk(u.currentPrice)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        meta: {
          headerClassName: "w-[200px]",
          cellClassName: "w-[200px]",
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
        size: 380,
        cell: ({ row }) => (
          <div className="min-w-0 font-medium truncate">
            {row.original.itemName}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB, columnId) => {
          const a = String(rowA.getValue(columnId) ?? "");
          const b = String(rowB.getValue(columnId) ?? "");
          return eveClientStringCompare(a, b);
        },
        meta: {
          headerClassName: "w-[420px] min-w-0",
          cellClassName: "w-[420px] min-w-0",
        },
      },
      {
        accessorKey: "remaining",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Qty"
            className="w-full justify-start"
          />
        ),
        size: 120,
        cell: ({ row }) => (
          <div className="text-left tabular-nums whitespace-nowrap">
            {row.original.remaining}
          </div>
        ),
        enableSorting: true,
        meta: {
          headerClassName: "w-[90px]",
          cellClassName: "w-[90px]",
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
        accessorFn: (row) => row.suggestedNewPriceTicked,
        size: 200,
        cell: ({ row }) => (
          <div className="font-medium text-left tabular-nums whitespace-nowrap">
            {formatIsk(row.original.suggestedNewPriceTicked)}
          </div>
        ),
        enableSorting: true,
        meta: {
          headerClassName: "w-[160px]",
          cellClassName: "w-[160px]",
        },
      },
      {
        id: "relistFee",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={`Relist Fee (${relistPct}%)`}
            className="w-full justify-start"
          />
        ),
        accessorFn: (row) =>
          row.remaining * row.suggestedNewPriceTicked * (relistPct / 100),
        size: 220,
        cell: ({ row }) => (
          <div className="font-medium text-left tabular-nums whitespace-nowrap">
            {formatIsk(
              row.original.remaining *
                row.original.suggestedNewPriceTicked *
                (relistPct / 100),
            )}
          </div>
        ),
        enableSorting: true,
        meta: {
          headerClassName: "w-[180px]",
          cellClassName: "w-[180px]",
        },
      },
    ],
    [copiedKey, onCopyPrice, relistPct, rowKeys, selectionStore],
  );

  const getRowClassName = React.useCallback((row: Row<UpdateRow>) => {
    const u = row.original;
    const category = getProfitCategory(u.estimatedMarginPercentAfter);
    return category === "red"
      ? "bg-red-100 dark:bg-red-950/30"
      : category === "yellow"
        ? "bg-yellow-100 dark:bg-yellow-950/30"
        : undefined;
  }, []);

  const getRowProps = React.useCallback((row: Row<UpdateRow>) => {
    const u = row.original;
    const expiryNote =
      u.isExpiringSoon && typeof u.expiresInHours === "number"
        ? `Expires in ${u.expiresInHours.toFixed(1)}h`
        : undefined;

    return {
      title:
        u.estimatedMarginPercentAfter !== undefined
          ? `Margin: ${u.estimatedMarginPercentAfter.toFixed(1)}%, Profit: ${formatIsk(u.estimatedProfitIskAfter ?? 0)}${expiryNote ? `, ${expiryNote}` : ""}`
          : expiryNote,
    };
  }, []);

  const footer = (
    <UndercutResultsFooter
      selectionStore={selectionStore}
      rows={rows}
      relistPct={relistPct}
    />
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(r) => r.__key}
      containerClassName="overflow-x-auto"
      tableClassName="table-fixed min-w-[760px]"
      initialSorting={[
        { id: "itemName", desc: false },
        { id: "remaining", desc: true },
        { id: "current", desc: true },
      ]}
      getRowClassName={getRowClassName}
      getRowProps={getRowProps}
      emptyState="No results."
      footer={footer}
    />
  );
}
