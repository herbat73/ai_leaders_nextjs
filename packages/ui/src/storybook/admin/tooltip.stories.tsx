import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../../admin/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../admin/tooltip";

const meta = {
  title: "Admin/Tooltip",
  component: Tooltip,
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm">
          SLA
        </Button>
      </TooltipTrigger>
      <TooltipContent>Odpowiedź do 2 dni roboczych od zgłoszenia</TooltipContent>
    </Tooltip>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
