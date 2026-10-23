import type { Meta, StoryObj } from "@storybook/react";

import { Stepper } from "../../public/stepper";

const steps = [
  { id: "items", label: "Produkty" },
  { id: "reasons", label: "Powody" },
  { id: "method", label: "Sposób zwrotu" },
  { id: "resolution", label: "Rozwiązanie" },
  { id: "summary", label: "Podsumowanie" },
];

const meta = {
  title: "Public/Stepper",
  component: Stepper,
  args: { steps, currentId: "items", label: "Postęp zgłoszenia" },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = {};
export const Middle: Story = { args: { currentId: "method" } };
export const Last: Story = { args: { currentId: "summary" } };
