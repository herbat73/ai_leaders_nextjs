import type { Meta, StoryObj } from "@storybook/react";

import { StageList } from "../../public/stage-list";

const meta = {
  title: "Public/StageList",
  component: StageList,
  args: {
    label: "Status zgłoszenia",
    stages: [
      { id: "submitted", label: "Zgłoszone", state: "done" },
      { id: "approved", label: "Zaakceptowane", state: "current" },
      { id: "in_transit", label: "W drodze", state: "upcoming" },
      { id: "received", label: "Odebrane", state: "upcoming" },
      { id: "resolved", label: "Rozliczone", state: "upcoming" },
    ],
  },
} satisfies Meta<typeof StageList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {};

export const Started: Story = {
  args: {
    stages: [
      { id: "submitted", label: "Zgłoszone", state: "current" },
      { id: "approved", label: "Zaakceptowane", state: "upcoming" },
      { id: "in_transit", label: "W drodze", state: "upcoming" },
      { id: "received", label: "Odebrane", state: "upcoming" },
      { id: "resolved", label: "Rozliczone", state: "upcoming" },
    ],
  },
};

export const Resolved: Story = {
  args: {
    stages: [
      { id: "submitted", label: "Zgłoszone", state: "done" },
      { id: "approved", label: "Zaakceptowane", state: "done" },
      { id: "in_transit", label: "W drodze", state: "done" },
      { id: "received", label: "Odebrane", state: "done" },
      { id: "resolved", label: "Rozliczone", state: "current" },
    ],
  },
};

export const ClosedWithReason: Story = {
  args: { closed: { label: "Zgłoszenie odrzucone", reason: "Minął termin na zwrot tego produktu." } },
};

export const ClosedWithoutReason: Story = { args: { closed: { label: "Zgłoszenie anulowane" } } };
