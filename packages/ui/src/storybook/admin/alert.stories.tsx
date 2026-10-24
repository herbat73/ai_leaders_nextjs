import type { Meta, StoryObj } from "@storybook/react";

import { Alert, AlertDescription, AlertTitle } from "../../admin/alert";

const meta = {
  title: "Admin/Alert",
  component: Alert,
  args: {
    children: (
      <>
        <AlertTitle>Zwrot czeka na decyzję</AlertTitle>
        <AlertDescription>Termin odpowiedzi mija jutro o 12:00.</AlertDescription>
      </>
    ),
  },
  argTypes: { variant: { control: "select", options: ["default", "info", "success", "warning", "destructive"] } },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Info: Story = { args: { variant: "info" } };
export const Success: Story = { args: { variant: "success" } };
export const Warning: Story = { args: { variant: "warning" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const TitleOnly: Story = { args: { variant: "info", children: <AlertTitle>Zapisano zmiany</AlertTitle> } };
