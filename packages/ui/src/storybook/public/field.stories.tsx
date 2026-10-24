import type { Meta, StoryObj } from "@storybook/react";

import { Field } from "../../public/field";
import { TextInput } from "../../public/text-input";

const meta = {
  title: "Public/Field",
  component: Field,
  args: { label: "Adres e-mail", children: null },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: (args) => <Field {...args}><TextInput type="email" autoComplete="email" /></Field> };

export const WithHint: Story = {
  args: { hint: "Użyjemy go tylko do informacji o zgłoszeniu." },
  render: (args) => <Field {...args}><TextInput type="email" /></Field>,
};

export const WithError: Story = {
  args: { hint: "Ten sam adres, który podano w zamówieniu.", error: "Podaj poprawny adres e-mail" },
  render: (args) => <Field {...args}><TextInput type="email" defaultValue="jan@" /></Field>,
};
