import type { Meta, StoryObj } from "@storybook/react";

import { RuleSummary } from "../../../admin/rules/rule-summary";

const labels = { settles: "Rozstrzyga", routes: "Kieruje", disabled: "Wyłączona", when: "Gdy", then: "Wtedy" };
const settling = { id: "R08", name: "Zwrot do 150 zł: automatyczna akceptacja", enabled: true, conditions: ["rodzaj: zwrot", "wartość ≤ 150,00 zł"], actions: ["automatyczna akceptacja"], settles: true };
const routing = { id: "R10a", name: "Szkoda transportowa: wysoki priorytet", enabled: true, conditions: ["rodzaj: szkoda transportowa"], actions: ["wysoki priorytet"], settles: false };

const meta = {
  title: "Admin/Rules/RuleSummary",
  component: RuleSummary,
  args: { labels, rules: [settling, routing] },
} satisfies Meta<typeof RuleSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SettlingAndRouting: Story = {};
export const DisabledRule: Story = { args: { rules: [{ ...routing, id: "R10c", enabled: false, conditions: [] }] } };
