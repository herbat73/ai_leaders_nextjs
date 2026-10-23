import type { Meta, StoryObj } from "@storybook/react";

import { Field } from "../../public/field";
import { TextInput } from "../../public/text-input";

const meta = {
  title: "Public/TextInput",
  component: TextInput,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Field label="Numer zamówienia"><TextInput {...args} placeholder="np. EZ-10234" /></Field>,
};

export const Invalid: Story = {
  render: (args) => (
    <Field label="Numer zamówienia" error="Nie znaleziono zamówienia o tym numerze"><TextInput {...args} defaultValue="XYZ" /></Field>
  ),
};

export const Disabled: Story = {
  render: (args) => <Field label="Numer zamówienia"><TextInput {...args} disabled defaultValue="EZ-10234" /></Field>,
};
