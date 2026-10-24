import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Checkbox } from "../../admin/checkbox";
import { Label } from "../../admin/label";

const meta = {
  title: "Admin/Checkbox",
  component: Checkbox,
  args: { id: "notify", onCheckedChange: fn() },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox {...args} />
      <Label htmlFor={args.id}>Powiadom klienta e-mailem</Label>
    </div>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { checked: "indeterminate" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };
