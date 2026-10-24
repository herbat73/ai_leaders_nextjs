import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton } from "../../admin/skeleton";

const meta = { title: "Admin/Skeleton", component: Skeleton } satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = { args: { className: "h-4 w-64" } };
export const TableRows: Story = {
  render: () => (
    <div role="status" aria-label="Ładowanie listy" className="w-96 space-y-3">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-3/4" />
    </div>
  ),
};
