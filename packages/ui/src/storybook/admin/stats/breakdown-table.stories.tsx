import type { Meta, StoryObj } from "@storybook/react";

import { BreakdownTable } from "../../../admin/stats/breakdown-table";

const meta = {
  title: "Admin/Stats/BreakdownTable",
  component: BreakdownTable,
  args: {
    caption: "Sprawy według rodzaju",
    columnLabels: { label: "Rodzaj", count: "Liczba", share: "Udział" },
    emptyMessage: "Brak danych.",
    rows: [
      { label: "Zwrot", count: 6, share: 0.5 },
      { label: "Reklamacja", count: 3, share: 0.25 },
      { label: "Szkoda transportowa", count: 2, share: 0.1667 },
    ],
  },
} satisfies Meta<typeof BreakdownTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {};
export const EmptyWithCaption: Story = { args: { rows: [] } };
