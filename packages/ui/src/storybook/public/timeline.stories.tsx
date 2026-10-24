import type { Meta, StoryObj } from "@storybook/react";

import { Timeline } from "../../public/timeline";

const meta = {
  title: "Public/Timeline",
  component: Timeline,
  args: { emptyMessage: "Brak zdarzeń.", events: [] },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const OneEvent: Story = {
  args: { events: [{ id: 1, label: "Zgłoszenie przyjęte", actor: "System", at: "23.10.2026, 12:05" }] },
};

export const SeveralEvents: Story = {
  args: {
    events: [
      { id: 1, label: "Zgłoszenie przyjęte", actor: "System", at: "23.10.2026, 12:05" },
      { id: 2, label: "Zgłoszenie zaakceptowane", actor: "Obsługa", at: "23.10.2026, 14:20", note: "Prosimy o odesłanie paczki w oryginalnym opakowaniu." },
      { id: 3, label: "Paczka w drodze", actor: "Przewoźnik", at: "24.10.2026, 09:00" },
    ],
  },
};
