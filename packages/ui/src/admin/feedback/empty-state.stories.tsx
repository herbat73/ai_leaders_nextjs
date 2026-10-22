import type { Meta, StoryObj } from "@storybook/react";

import { EmptyState } from "./empty-state";

const meta = {
  title: "Admin/Feedback/EmptyState",
  component: EmptyState,
  args: { message: "No returns yet." },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
