import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { ResolutionStep, type ResolutionStepProps } from "../../../public/returns/resolution-step";

function Controlled(args: ResolutionStepProps) {
  const [value, setValue] = useState<string | null>(args.value);
  const [note, setNote] = useState(args.exchange?.value ?? "");
  return (
    <ResolutionStep
      {...args}
      value={value}
      onChange={setValue}
      exchange={args.exchange && value === "exchange" ? { ...args.exchange, value: note, onChange: setNote } : undefined}
    />
  );
}

const meta = {
  title: "Public/Returns/ResolutionStep",
  component: ResolutionStep,
  args: {
    legend: "Co chcesz otrzymać w zamian?",
    options: [
      { value: "refund", label: "Zwrot pieniędzy", description: "Na konto użyte do płatności" },
      { value: "store_credit", label: "Bon do sklepu", description: "Ważny 12 miesięcy" },
      { value: "exchange", label: "Wymiana", description: "Na inny rozmiar lub kolor" },
    ],
    value: null,
    onChange: () => undefined,
    quote: { status: "idle" },
  },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ResolutionStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const QuotePending: Story = { args: { value: "refund", quote: { status: "pending", pendingText: "Liczymy kwotę zwrotu…" } } };
export const QuoteShown: Story = {
  args: { value: "refund", quote: { status: "ready", title: "Wyliczona kwota", amountLabel: "Do zwrotu", amountText: "386,01 zł", feeLabel: "Opłata za zwrot", feeText: "12,99 zł" } },
};
export const Exchange: Story = {
  args: {
    value: "exchange",
    quote: { status: "ready", title: "Wyliczona wartość wymiany", amountLabel: "Wartość", amountText: "399,00 zł" },
    exchange: { label: "Na co chcesz wymienić?", hint: "Np. rozmiar 43", value: "", onChange: () => undefined },
  },
};
export const QuoteError: Story = { args: { value: "refund", quote: { status: "error", errorText: "Nie udało się wyliczyć kwoty. Spróbuj ponownie." } } };
