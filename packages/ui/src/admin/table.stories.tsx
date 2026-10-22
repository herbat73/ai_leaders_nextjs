import type { Meta, StoryObj } from "@storybook/react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = {
  title: "Admin/Table",
  component: Table,
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>ORD-10042</TableCell>
          <TableCell>approved</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>ORD-10043</TableCell>
          <TableCell>requested</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
