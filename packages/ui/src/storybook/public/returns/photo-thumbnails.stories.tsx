import type { Meta, StoryObj } from "@storybook/react";

import { PhotoThumbnails } from "../../../public/returns/photo-thumbnails";

const svg = (color: string): string => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='160' height='120' fill='%23${color}'/></svg>`;

const meta = {
  title: "Public/Returns/PhotoThumbnails",
  component: PhotoThumbnails,
  args: {
    label: "Zdjęcia do zgłoszenia",
    items: [
      { href: svg("889"), src: svg("889"), caption: "front.jpg", linkLabel: "Otwórz zdjęcie: front.jpg" },
      { href: svg("898"), src: svg("898"), caption: "tyl.png", linkLabel: "Otwórz zdjęcie: tyl.png" },
      { href: svg("988"), src: svg("988"), caption: "bardzo-dluga-nazwa-pliku-ze-zdjeciem-uszkodzonego-opakowania.webp", linkLabel: "Otwórz zdjęcie: bardzo-dluga-nazwa-pliku-ze-zdjeciem-uszkodzonego-opakowania.webp" },
    ],
  },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof PhotoThumbnails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SinglePhoto: Story = { args: { items: [{ href: svg("889"), src: svg("889"), caption: "front.jpg", linkLabel: "Otwórz zdjęcie: front.jpg" }] } };
