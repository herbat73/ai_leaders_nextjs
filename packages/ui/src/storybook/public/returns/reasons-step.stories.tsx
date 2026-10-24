import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { ReasonsStep, type ReasonsStepProps } from "../../../public/returns/reasons-step";

const reasonOptions: ReasonsStepProps["reasonOptions"] = [
  { value: "damaged", label: "Produkt uszkodzony" },
  { value: "wrong_item", label: "Otrzymałem inny produkt" },
  { value: "not_as_described", label: "Niezgodny z opisem" },
  { value: "wrong_size", label: "Nieodpowiedni rozmiar" },
  { value: "changed_mind", label: "Rozmyśliłem się" },
  { value: "other", label: "Inny powód" },
];

function Controlled(args: ReasonsStepProps) {
  const [items, setItems] = useState(args.items);
  const patch = (id: string, p: Partial<ReasonsStepProps["items"][number]>) => setItems((xs) => xs.map((x) => (x.lineId === id ? { ...x, ...p } : x)));
  return (
    <ReasonsStep
      {...args}
      items={items}
      onReasonChange={(id, reason) => patch(id, { reason })}
      onCommentChange={(id, comment) => patch(id, { comment, counterText: `${comment.length} / 500` })}
    />
  );
}

const item = (lineId: string, title: string): ReasonsStepProps["items"][number] => ({
  lineId,
  title,
  reason: null,
  comment: "",
  reasonLegend: `Powód zwrotu: ${title}`,
  commentLabel: "Komentarz (opcjonalnie)",
  commentHint: "Opisz krótko, co poszło nie tak",
  counterText: "0 / 500",
});

const meta = {
  title: "Public/Returns/ReasonsStep",
  component: ReasonsStep,
  args: { items: [item("l1", "Buty trekkingowe")], reasonOptions, maxCommentLength: 500, onReasonChange: () => undefined, onCommentChange: () => undefined },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ReasonsStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TwoItems: Story = { args: { items: [item("l1", "Buty trekkingowe"), { ...item("l2", "Plecak 30 l"), reason: "damaged", comment: "Pęknięty zamek", counterText: "14 / 500" }] } };
export const WithErrors: Story = { args: { items: [{ ...item("l1", "Buty trekkingowe"), reasonError: "Wybierz powód zwrotu", commentError: "Komentarz jest za długi" }] } };
