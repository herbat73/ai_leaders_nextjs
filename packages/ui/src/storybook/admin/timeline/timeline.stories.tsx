import type { Meta, StoryObj } from "@storybook/react";

import { Timeline } from "../../../admin/timeline/timeline";

const meta = {
  title: "Admin/Timeline",
  component: Timeline,
  args: { emptyMessage: "No history yet.", events: [] },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const OneEvent: Story = {
  args: { events: [{ id: 1, label: "Zgłoszenie utworzone", actor: "System", at: "23.10.2026, 12:05" }] },
};

export const SeveralEvents: Story = {
  args: {
    events: [
      { id: 1, label: "Zgłoszenie utworzone", actor: "System", at: "23.10.2026, 12:05" },
      {
        id: 2,
        label: "Zatwierdzone",
        actor: "Agent",
        at: "23.10.2026, 14:30",
        note: "Zwrot w terminie, produkt nieużywany.",
      },
      { id: 3, label: "W drodze", actor: "Agent", at: "24.10.2026, 09:10" },
    ],
  },
};

export const LongNote: Story = {
  args: {
    events: [
      { id: 1, label: "Zgłoszenie utworzone", actor: "System", at: "23.10.2026, 12:05" },
      {
        id: 2,
        label: "Odrzucone",
        actor: "Agent",
        at: "23.10.2026, 14:30",
        note: "Produkt nosi ślady użytkowania wykraczające poza sprawdzenie.\nZgodnie z regulaminem zwrot nie przysługuje.",
      },
    ],
  },
};
