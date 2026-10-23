import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { MethodStep, type MethodStepProps } from "../../../public/returns/method-step";

function Controlled(args: MethodStepProps) {
  const [value, setValue] = useState<string | null>(args.value);
  return <MethodStep {...args} value={value} onChange={setValue} />;
}

const meta = {
  title: "Public/Returns/MethodStep",
  component: MethodStep,
  args: {
    legend: "Jak chcesz odesłać produkty?",
    options: [
      { value: "courier_pickup", label: "Odbiór przez kuriera", description: "Opłata: 12,99 zł" },
      { value: "parcel_locker", label: "Paczkomat", description: "Opłata: 8,99 zł" },
      { value: "drop_off", label: "Punkt stacjonarny", description: "Bezpłatnie" },
    ],
    value: null,
    onChange: () => undefined,
  },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof MethodStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { value: "parcel_locker" } };
export const Invalid: Story = { args: { error: "Wybierz sposób zwrotu" } };
