import type { ReactElement } from "react";

import { DataTable, type DataTableColumn } from "../tables/data-table";

export interface BreakdownRow {
  label: string;
  count: number;
  /** 0–1, shown as a whole percent. */
  share: number;
}

export interface BreakdownTableProps {
  caption: string;
  columnLabels: { label: string; count: string; share: string };
  rows: BreakdownRow[];
  /** Always passed by the caller: `ui` keeps no default strings. */
  emptyMessage: string;
}

export function BreakdownTable({ caption, columnLabels, rows, emptyMessage }: BreakdownTableProps): ReactElement {
  const columns: DataTableColumn<BreakdownRow>[] = [
    { key: "label", header: columnLabels.label, className: "font-medium", cell: (row) => row.label },
    { key: "count", header: columnLabels.count, cell: (row) => row.count },
    { key: "share", header: columnLabels.share, cell: (row) => `${Math.round(row.share * 100)}%` },
  ];
  return <DataTable caption={caption} columns={columns} rows={rows} getRowKey={(row) => row.label} emptyMessage={emptyMessage} />;
}
