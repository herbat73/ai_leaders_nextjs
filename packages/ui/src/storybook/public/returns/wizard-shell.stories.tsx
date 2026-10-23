import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { WizardShell, type WizardShellProps } from "../../../public/returns/wizard-shell";

const steps = [
  { id: "items", label: "Produkty" },
  { id: "reasons", label: "Powody" },
  { id: "method", label: "Sposób zwrotu" },
  { id: "resolution", label: "Rozwiązanie" },
  { id: "summary", label: "Podsumowanie" },
];

function Interactive(args: WizardShellProps) {
  const [index, setIndex] = useState(steps.findIndex((s) => s.id === args.currentId));
  const step = steps[index];
  return (
    <WizardShell
      {...args}
      currentId={step.id}
      focusKey={step.id}
      heading={step.label}
      showBack={index > 0}
      showNext={index < steps.length - 1}
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
    >
      <p className="text-sm text-muted-foreground">Treść kroku: {step.label}</p>
    </WizardShell>
  );
}

const meta = {
  title: "Public/Returns/WizardShell",
  component: WizardShell,
  args: {
    steps,
    currentId: "items",
    stepperLabel: "Postęp zgłoszenia",
    stepDoneLabel: "ukończony",
    heading: "Produkty",
    focusKey: "items",
    backLabel: "Wstecz",
    nextLabel: "Dalej",
    showBack: false,
    showNext: true,
    onBack: () => undefined,
    onNext: () => undefined,
    children: null,
  },
  render: (args) => <Interactive {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof WizardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {};
export const MiddleStep: Story = { args: { currentId: "method" } };
export const NextDisabled: Story = { render: (args) => <WizardShell {...args} showBack nextDisabled>{<p className="text-sm">Wybierz produkt, aby przejść dalej.</p>}</WizardShell> };
export const LastStep: Story = { render: (args) => <WizardShell {...args} currentId="summary" heading="Podsumowanie" showBack showNext={false}><p className="text-sm">Podsumowanie</p></WizardShell> };
