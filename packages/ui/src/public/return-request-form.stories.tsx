import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { ReturnRequestForm, type ReturnRequestFormProps } from "./return-request-form";

type Submit = ReturnRequestFormProps["onSubmit"];

const meta = {
  title: "Public/ReturnRequestForm",
  component: ReturnRequestForm,
  args: { onSubmit: fn<Submit>(async () => null) },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ReturnRequestForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Submitting succeeds and shows the confirmation. */
export const Default: Story = {};

export const FieldErrors: Story = {
  args: {
    onSubmit: fn<Submit>(async () => ({ orderNumber: "Order number is required", customerEmail: "Enter a valid email" })),
  },
};

export const NetworkFailure: Story = {
  args: {
    onSubmit: fn<Submit>(async () => {
      throw new Error("Network error");
    }),
  },
};
