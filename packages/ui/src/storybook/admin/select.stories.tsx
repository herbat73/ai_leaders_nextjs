import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Label } from "../../admin/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../../admin/select";

const meta = {
  title: "Admin/Select",
  component: Select,
  args: { onValueChange: fn() },
  decorators: [(Story) => <div className="w-64 space-y-1">{Story()}</div>],
  render: (args) => (
    <>
      <Label htmlFor="resolution">Rozwiązanie</Label>
      <Select {...args}>
        <SelectTrigger id="resolution" className="w-full">
          <SelectValue placeholder="Wybierz rozwiązanie" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Dla klienta</SelectLabel>
            <SelectItem value="refund">Zwrot środków</SelectItem>
            <SelectItem value="exchange">Wymiana</SelectItem>
            <SelectItem value="repair" disabled>
              Naprawa (niedostępna)
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "exchange" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "refund" } };
