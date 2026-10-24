import type { Meta, StoryObj } from "@storybook/react";

import { Banner } from "../../public/banner";

const meta = {
  title: "Public/Banner",
  component: Banner,
  args: { tone: "info", children: "Odpowiemy w ciągu 2 dni roboczych." },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};
export const Warning: Story = { args: { tone: "warning", children: "Potrzebujemy od Ciebie dodatkowych informacji, aby kontynuować." } };
export const Error: Story = { args: { tone: "error", children: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie." } };
export const Success: Story = { args: { tone: "success", children: "Zgłoszenie zostało wysłane. Numer RMA: RMA-2026-00042." } };
