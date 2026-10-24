import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { ActionButton, actionClassName } from "../../public/action-button";

const meta = {
  title: "Public/ActionButton",
  component: ActionButton,
  args: { children: "Rozpocznij zwrot", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "link"] },
    size: { control: "inline-radio", options: ["default", "lg"] },
  },
} satisfies Meta<typeof ActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const FullWidth: Story = { args: { fullWidth: true, children: "Sprawdź zamówienie" }, decorators: [(Story) => <div className="max-w-sm">{Story()}</div>] };
export const Pending: Story = { args: { disabled: true, children: "Sprawdzamy…" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Wstecz" } };
export const Large: Story = { args: { size: "lg", children: "Wyślij zgłoszenie" } };
export const Link: Story = { args: { variant: "link", children: "Wyloguj" } };
/** For a Next `<Link>` or any anchor: `ui` is Next-free, so it exports the class instead of a link component. */
export const AsAnchor: Story = { render: () => <a href="#zwroty" className={actionClassName()}>Moje zwroty</a> };
