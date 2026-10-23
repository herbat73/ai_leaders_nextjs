import type { Meta, StoryObj } from "@storybook/react";

import { Textarea } from "../../admin/textarea";

const meta = {
  title: "Admin/Textarea",
  component: Textarea,
  args: { placeholder: "Reason for the decision", "aria-label": "Reason for the decision" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: "The item was worn and returned after the 14-day period." } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked while the request is saved." } };
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Too short" } };
