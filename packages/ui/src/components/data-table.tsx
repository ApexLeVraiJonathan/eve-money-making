"use client";

import {
  type Column,
  type ColumnDef,
  type Row,
  type Table as ReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "../button";
import { cn } from "../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

type DataTableColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

function getColumnMeta(meta: unknown): DataTableColumnMeta | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  return meta as DataTableColumnMeta;
}

type UseDataTableOptions<TData> = {
  data: Array<TData>;
  columns: Array<ColumnDef<TData, unknown>>;
  getRowId?: (row: TData) => string;
  initialSorting?: SortingState;
};

export function useDataTable<TData>(options: UseDataTableOptions<TData>) {
  const { data, columns, getRowId, initialSorting = [] } = options;

  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return {
    table,
    sorting,
    setSorting,
  };
}

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

export const DataTableColumnHeader = <TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) => {
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();

  if (!canSort) {
    return (
      <span
        className={cn(
          "flex h-8 items-center text-sm font-medium text-foreground",
          className,
        )}
      >
        {title}
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "flex h-8 items-center gap-2 px-0 text-sm font-medium text-foreground",
        className,
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDown className="h-4 w-4" />
      ) : sorted === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      )}
    </Button>
  );
};

export type DataTableProps<TData> = {
  data: Array<TData>;
  columns: Array<ColumnDef<TData, unknown>>;
  getRowId?: (row: TData) => string;
  initialSorting?: SortingState;
  emptyState?: React.ReactNode;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  getRowProps?: (row: Row<TData>) => React.HTMLAttributes<HTMLTableRowElement>;
  containerClassName?: string;
  tableClassName?: string;
  /**
   * Optional <tfoot> (e.g. totals row). Keep this generic so feature tables
   * can inject their own footer without re-implementing the base layout.
   */
  footer?: React.ReactNode;
};

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  initialSorting,
  emptyState = "No results.",
  getRowClassName,
  getRowProps,
  containerClassName,
  tableClassName,
  footer,
}: DataTableProps<TData>) {
  const { table } = useDataTable({
    data,
    columns,
    getRowId,
    initialSorting,
  });

  const colSpan = table.getAllLeafColumns().length;

  return (
    <div className={cn("overflow-hidden rounded-md border", containerClassName)}>
      <Table className={tableClassName}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    getColumnMeta(header.column.columnDef.meta)?.headerClassName,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={getRowClassName?.(row)}
                {...(getRowProps?.(row) ?? {})}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      getColumnMeta(cell.column.columnDef.meta)?.cellClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-24 text-center">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {footer}
      </Table>
    </div>
  );
}

export type { ReactTable as DataTableTable };
