import type { Meta, StoryObj } from "@storybook/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

const meta = {
  title: "Admin/Card",
  component: Card,
  render: (args) => (
    <Card {...args} className="max-w-md">
      <CardHeader>
        <CardTitle>Returns</CardTitle>
        <CardDescription>3 return request(s)</CardDescription>
      </CardHeader>
      <CardContent>Card content goes here.</CardContent>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
