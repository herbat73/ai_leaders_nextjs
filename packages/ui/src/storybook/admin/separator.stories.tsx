import type { Meta, StoryObj } from "@storybook/react";

import { Separator } from "../../admin/separator";

const meta = { title: "Admin/Separator", component: Separator } satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64 space-y-3 text-sm">
      <p>Dane klienta</p>
      <Separator {...args} />
      <p>Pozycje zwrotu</p>
    </div>
  ),
};
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Szczegóły</span>
      <Separator {...args} />
      <span>Historia</span>
    </div>
  ),
};
