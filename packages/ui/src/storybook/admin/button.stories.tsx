import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Button } from "../../admin/button";

const meta = {
  title: "Admin/Button",
  component: Button,
  args: { children: "Save", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "destructive"] },
    size: { control: "inline-radio", options: ["default", "sm"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline", children: "Cancel" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Reject" } };
export const Small: Story = { args: { size: "sm" } };
export const Disabled: Story = { args: { disabled: true, children: "Saving…" } };
