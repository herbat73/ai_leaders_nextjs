import type { Meta, StoryObj } from "@storybook/react";

import { ThemeToggle } from "../theme-toggle";

const meta = {
  title: "Shared/ThemeToggle",
  component: ThemeToggle,
  parameters: { layout: "fullscreen", docs: { story: { inline: false, height: "80px" } } },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fixed to the top-right corner; it flips the same `dark` class as the toolbar theme switch. */
export const Default: Story = {};
