import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Admin/Label",
  component: Label,
  args: { children: "Customer email", htmlFor: "label-story-email" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithInput: Story = {
  render: (args) => (
    <div className="max-w-sm space-y-1">
      <Label {...args} />
      <Input id="label-story-email" type="email" />
    </div>
  ),
};
