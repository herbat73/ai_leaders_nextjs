import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { SummaryStep, type SummaryStepProps } from "../../../public/returns/summary-step";

function Controlled(args: SummaryStepProps) {
  const [checked, setChecked] = useState(args.acknowledgement.checked);
  return <SummaryStep {...args} acknowledgement={{ ...args.acknowledgement, checked, onChange: setChecked }} />;
}

const meta = {
  title: "Public/Returns/SummaryStep",
  component: SummaryStep,
  args: {
    itemsHeading: "Zwracane produkty",
    items: [
      { title: "Buty trekkingowe", quantityText: "2 szt.", reasonText: "Powód: nieodpowiedni rozmiar", comment: "Za ciasne w palcach" },
      { title: "Plecak 30 l", quantityText: "1 szt.", reasonText: "Powód: produkt uszkodzony" },
    ],
    rows: [
      { label: "Sposób zwrotu", value: "Paczkomat" },
      { label: "Rozwiązanie", value: "Zwrot pieniędzy" },
      { label: "Kwota do zwrotu", value: "386,01 zł" },
    ],
    acknowledgement: { label: "Potwierdzam, że dane są prawdziwe i zapoznałem się z zasadami zwrotów", checked: false, onChange: () => undefined },
    submit: { label: "Wyślij zgłoszenie", pendingLabel: "Wysyłanie…", pending: false, onSubmit: () => undefined },
  },
  render: (args) => <Controlled {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof SummaryStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Acknowledged: Story = {
  args: { acknowledgement: { label: "Potwierdzam, że dane są prawdziwe i zapoznałem się z zasadami zwrotów", checked: true, onChange: () => undefined } },
};
export const AcknowledgementMissing: Story = {
  args: { acknowledgement: { label: "Potwierdzam, że dane są prawdziwe i zapoznałem się z zasadami zwrotów", checked: false, onChange: () => undefined, error: "Potwierdź, aby wysłać zgłoszenie" } },
};
export const Pending: Story = {
  args: { acknowledgement: { label: "Potwierdzam, że dane są prawdziwe i zapoznałem się z zasadami zwrotów", checked: true, onChange: () => undefined }, submit: { label: "Wyślij zgłoszenie", pendingLabel: "Wysyłanie…", pending: true, onSubmit: () => undefined } },
};
export const SubmitError: Story = { args: { errorText: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę." } };
