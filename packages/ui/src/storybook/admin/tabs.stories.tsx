import type { Meta, StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../admin/tabs";

const meta = {
  title: "Admin/Tabs",
  component: Tabs,
  args: { defaultValue: "details" },
  render: (args) => (
    <Tabs {...args} className="max-w-xl">
      <TabsList>
        <TabsTrigger value="details">Szczegóły</TabsTrigger>
        <TabsTrigger value="history">Historia</TabsTrigger>
        <TabsTrigger value="notes" disabled>
          Notatki
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">Pozycje zwrotu i dane klienta.</TabsContent>
      <TabsContent value="history">Oś czasu zdarzeń.</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Line: Story = {
  render: (args) => (
    <Tabs {...args} className="max-w-xl">
      <TabsList variant="line">
        <TabsTrigger value="details">Szczegóły</TabsTrigger>
        <TabsTrigger value="history">Historia</TabsTrigger>
      </TabsList>
      <TabsContent value="details">Pozycje zwrotu i dane klienta.</TabsContent>
      <TabsContent value="history">Oś czasu zdarzeń.</TabsContent>
    </Tabs>
  ),
};
