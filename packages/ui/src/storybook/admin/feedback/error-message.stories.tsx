import type { Meta, StoryObj } from "@storybook/react";

import { ErrorMessage } from "../../../admin/feedback/error-message";

const meta = {
  title: "Admin/Feedback/ErrorMessage",
  component: ErrorMessage,
  args: { message: "Could not load returns." },
} satisfies Meta<typeof ErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
