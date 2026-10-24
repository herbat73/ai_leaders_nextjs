import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { ChoiceGroup, type ChoiceGroupProps } from "../../public/choice-group";

const options: ChoiceGroupProps["options"] = [
  { value: "refund", label: "Zwrot pieniędzy", description: "Na to samo konto, z którego płacono" },
  { value: "store_credit", label: "Bon do sklepu", description: "Ważny 12 miesięcy" },
  { value: "exchange", label: "Wymiana", disabled: true, disabledReason: "Wymiana jest niedostępna dla tego produktu" },
];

function Controlled(args: ChoiceGroupProps) {
  const [value, setValue] = useState<string | null>(args.value);
  return <ChoiceGroup {...args} value={value} onChange={setValue} />;
}

const meta = {
  title: "Public/ChoiceGroup",
  component: ChoiceGroup,
  args: { legend: "Wybierz formę rozwiązania", options, value: null, onChange: () => undefined },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ChoiceGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { value: "refund" } };
export const DisabledWithReason: Story = { args: { value: "store_credit" } };
export const Invalid: Story = { args: { error: "Wybierz jedną z opcji" } };
