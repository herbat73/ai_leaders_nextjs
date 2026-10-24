import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { LinePicker, type LinePickerLine, type LinePickerProps } from "../../../public/returns/line-picker";

const base: LinePickerLine[] = [
  { id: "l1", title: "Buty trekkingowe", detail: "SKU BT-42 · 399,00 zł", remainingQuantity: 3, eligible: true, selected: false, quantity: 1, quantityLabel: "Liczba sztuk: Buty trekkingowe", capText: "Maksymalnie 3 szt." },
  { id: "l2", title: "Plecak 30 l", detail: "SKU PL-30 · 249,00 zł", remainingQuantity: 1, eligible: true, selected: false, quantity: 1, quantityLabel: "Liczba sztuk: Plecak 30 l", capText: "Maksymalnie 1 szt." },
  { id: "l3", title: "Bon podarunkowy", detail: "SKU BON-100", remainingQuantity: 0, eligible: false, ineligibleReason: "Bonów podarunkowych nie można zwrócić", selected: false, quantity: 1, quantityLabel: "Liczba sztuk: Bon podarunkowy" },
];

function Controlled(args: LinePickerProps) {
  const [lines, setLines] = useState(args.lines);
  return (
    <LinePicker
      {...args}
      lines={lines}
      onToggle={(id, selected) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, selected } : l)))}
      onQuantityChange={(id, quantity) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity } : l)))}
    />
  );
}

const meta = {
  title: "Public/Returns/LinePicker",
  component: LinePicker,
  args: { legend: "Które produkty chcesz zwrócić?", lines: base, decreaseLabel: "Zmniejsz liczbę sztuk", increaseLabel: "Zwiększ liczbę sztuk", onToggle: () => undefined, onQuantityChange: () => undefined },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof LinePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { lines: base.map((l) => (l.id === "l1" ? { ...l, selected: true, quantity: 2 } : l)) } };
export const QuantityAtCap: Story = { args: { lines: base.map((l) => (l.id === "l1" ? { ...l, selected: true, quantity: 3 } : l)) } };
export const Invalid: Story = { args: { error: "Wybierz co najmniej jeden produkt" } };
