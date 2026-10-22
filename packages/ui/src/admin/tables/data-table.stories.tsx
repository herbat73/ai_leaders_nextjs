import type { Meta, StoryObj } from "@storybook/react";

import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  id: number;
  order: string;
  email: string;
  status: string;
}

const rows: Row[] = [
  { id: 1, order: "ORD-10042", email: "anna@example.com", status: "approved" },
  { id: 2, order: "ORD-10043", email: "piotr@example.com", status: "requested" },
  { id: 3, order: "ORD-10051", email: "ola@example.com", status: "rejected" },
];

const columns: DataTableColumn<Row>[] = [
  { key: "order", header: "Order", className: "font-medium", cell: (row) => row.order },
  { key: "email", header: "Customer", cell: (row) => row.email },
  { key: "status", header: "Status", cell: (row) => row.status },
];

// DataTable is generic; the meta is typed for the story row shape.
const meta = {
  title: "Admin/DataTable",
  component: DataTable<Row>,
  args: { columns, rows, getRowKey: (row: Row) => row.id },
} satisfies Meta<typeof DataTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRows: Story = {};
export const Empty: Story = { args: { rows: [], emptyMessage: "No returns yet." } };
export const Loading: Story = { args: { loading: true } };
export const Error: Story = { args: { error: "Could not load returns." } };
