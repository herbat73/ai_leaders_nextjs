import type { ReactElement, ReactNode } from "react";

import { EmptyState } from "../feedback/empty-state";
import { ErrorMessage } from "../feedback/error-message";
import { LoadingMessage } from "../feedback/loading-message";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../table";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  /** Accessible table title. With no rows it still renders (above the empty message); without it nothing changes. */
  caption?: string;
}

/** Column-config-driven list with built-in loading, error and empty states. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error,
  emptyMessage = "Nothing to show yet.",
  caption,
}: DataTableProps<T>): ReactElement {
  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage message={error} />;
  if (rows.length === 0) {
    if (caption === undefined) return <EmptyState message={emptyMessage} />;
    return (
      <>
        <Table>
          <TableCaption>{caption}</TableCaption>
        </Table>
        <EmptyState message={emptyMessage} />
      </>
    );
  }

  return (
    <Table>
      {caption !== undefined && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
