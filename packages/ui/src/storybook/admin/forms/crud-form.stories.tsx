import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { CrudForm, type CrudFormField, type CrudFormProps } from "../../../admin/forms/crud-form";

type Submit = CrudFormProps["onSubmit"];

const fields: CrudFormField[] = [
  { name: "orderNumber", label: "Order number" },
  { name: "customerEmail", label: "Email", type: "email" },
  { name: "reason", label: "Reason", type: "textarea" },
];

const meta = {
  title: "Admin/CrudForm",
  component: CrudForm,
  args: { fields, onSubmit: fn<Submit>(async () => null), onCancel: fn() },
} satisfies Meta<typeof CrudForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClientValidation: Story = {
  args: {
    validate: (values) => (values.orderNumber ? null : { orderNumber: "Order number is required" }),
  },
};

export const ServerErrors: Story = {
  args: {
    onSubmit: fn<Submit>(async () => ({ customerEmail: "Email does not match the order", form: "Please check the fields above" })),
  },
};

export const WithoutCancel: Story = { args: { onCancel: undefined, submitLabel: "Create" } };

export const PasswordField: Story = {
  args: {
    fields: [
      { name: "email", label: "E-mail", type: "email", autoComplete: "username" },
      { name: "password", label: "Hasło", type: "password", autoComplete: "current-password" },
    ],
    onCancel: undefined,
    submitLabel: "Zaloguj",
    pendingLabel: "Logowanie…",
    showPasswordLabel: "Pokaż hasło",
    hidePasswordLabel: "Ukryj hasło",
  },
};
