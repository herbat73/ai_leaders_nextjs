import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta = {
  title: "Admin/Input",
  component: Input,
  args: { placeholder: "Order number", "aria-label": "Order number" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: "ORD-10042" } };
export const Email: Story = { args: { type: "email", placeholder: "you@example.com", "aria-label": "Email" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "ORD-10042" } };
