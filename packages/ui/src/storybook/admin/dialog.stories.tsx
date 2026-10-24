import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Button } from "../../admin/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../admin/dialog";

const meta = {
  title: "Admin/Dialog",
  component: Dialog,
  args: { onOpenChange: fn() },
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="destructive">Odrzuć zwrot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odrzucić zwrot RMA-2026-00042?</DialogTitle>
          <DialogDescription>Klient dostanie e-mail z powodem odrzucenia. Tej decyzji nie da się cofnąć.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button variant="destructive">Odrzuć zwrot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
