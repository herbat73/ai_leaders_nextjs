import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../../admin/badge";

const meta = {
  title: "Admin/Badge",
  component: Badge,
  args: { children: "approved" },
  argTypes: { variant: { control: "select", options: ["default", "secondary", "destructive", "outline", "success", "warning", "info"] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "received" } };
export const Destructive: Story = { args: { variant: "destructive", children: "rejected" } };
export const Outline: Story = { args: { variant: "outline", children: "requested" } };
export const Success: Story = { args: { variant: "success", children: "resolved" } };
export const Warning: Story = { args: { variant: "warning", children: "awaiting_customer" } };
export const Info: Story = { args: { variant: "info", children: "in_transit" } };
