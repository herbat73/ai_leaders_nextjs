import type { Meta, StoryObj } from "@storybook/react";

import { LoadingMessage } from "../../../admin/feedback/loading-message";

const meta = {
  title: "Admin/Feedback/LoadingMessage",
  component: LoadingMessage,
} satisfies Meta<typeof LoadingMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CustomMessage: Story = { args: { message: "Calculating…" } };
