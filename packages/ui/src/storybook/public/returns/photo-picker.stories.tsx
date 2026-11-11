import type { Meta, StoryObj } from "@storybook/react";

import { PhotoPicker, type PhotoPickerProps } from "../../../public/returns/photo-picker";

const base: PhotoPickerProps = {
  legend: "Zdjęcia",
  hint: "Dodaj od 1 do 6 zdjęć: uszkodzony produkt i opakowanie albo zawartość paczki. Zdjęcie ma być ostre i zrobione z bliska. Nie pokazuj adresu ani osób.",
  addLabel: "Dodaj zdjęcia",
  accept: "image/jpeg,image/png,image/webp",
  items: [],
  counterText: "0 z 6 zdjęć, do 5 MB każde",
  removeText: "Usuń",
  removeLabel: (name) => `Usuń zdjęcie ${name}`,
  onAdd: () => undefined,
  onRemove: () => undefined,
};

const meta = {
  title: "Public/Returns/PhotoPicker",
  component: PhotoPicker,
  args: base,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof PhotoPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Mixed: Story = {
  args: {
    items: [
      { id: "1", name: "front.jpg", sizeText: "1,2 MB", status: "done", statusText: "Dodane", previewUrl: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23888'/%3E%3C/svg%3E" },
      { id: "2", name: "tyl.png", sizeText: "3,4 MB", status: "uploading", statusText: "Wysyłanie…" },
      { id: "3", name: "film.mp4", sizeText: "9,9 MB", status: "error", statusText: "Za duży plik: do 5 MB" },
    ],
    counterText: "3 z 6 zdjęć, do 5 MB każde",
  },
};
export const ScannerDown: Story = {
  args: { items: [{ id: "1", name: "front.jpg", sizeText: "1,2 MB", status: "error", statusText: "Nie możemy teraz przyjąć zdjęć, spróbuj za chwilę" }] },
};
export const LimitReached: Story = {
  args: {
    items: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `zdjecie-${i + 1}.jpg`, sizeText: "0,8 MB", status: "done" as const, statusText: "Dodane" })),
    counterText: "6 z 6 zdjęć, do 5 MB każde",
    disabled: true,
    disabledText: "Dodano maksymalną liczbę zdjęć (6). Usuń jedno, aby dodać inne.",
  },
};
export const MissingError: Story = { args: { error: "Dodaj co najmniej jedno zdjęcie." } };
