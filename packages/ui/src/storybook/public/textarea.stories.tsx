import type { Meta, StoryObj } from "@storybook/react";

import { Field } from "../../public/field";
import { Textarea } from "../../public/textarea";

const meta = {
  title: "Public/Textarea",
  component: Textarea,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Field label="Opis problemu" hint="Opcjonalnie"><Textarea {...args} /></Field>,
};

export const Invalid: Story = {
  render: (args) => <Field label="Opis problemu" error="Opis może mieć najwyżej 500 znaków"><Textarea {...args} defaultValue="Za długi opis…" /></Field>,
};

export const Disabled: Story = {
  render: (args) => <Field label="Opis problemu"><Textarea {...args} disabled defaultValue="Nie można edytować." /></Field>,
};
