import type { Meta, StoryObj } from "@storybook/react";

import { StatRow, StatTile } from "../../../admin/stats/stat-tile";

const meta = {
  title: "Admin/Stats/StatTile",
  component: StatTile,
  args: { label: "Sprawy z dopytaniem", value: "75%" },
  decorators: [
    (Story) => (
      <StatRow>
        <Story />
      </StatRow>
    ),
  ],
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithoutHint: Story = {};
export const WithHint: Story = { args: { hint: "przedział 95%: 47–91%" } };
export const Row: Story = {
  render: () => (
    <StatRow>
      <StatTile label="Liczba spraw" value="12" />
      <StatTile label="Sprawy z dopytaniem" value="75%" hint="przedział 95%: 47–91%" />
      <StatTile label="Mediana wiadomości" value="4" />
      <StatTile label="Rozstrzygnięte regułą" value="58%" hint="przedział 95%: 32–81%" />
    </StatRow>
  ),
};
