import type { Meta, StoryObj } from "@storybook/react";

import { FileImport, FileImportView } from "../../../admin/forms/file-import";

const messages = {
  tooLarge: "Plik jest zbyt duży (limit 512 KB)",
  wrongEncoding: "Zapisz plik jako CSV UTF-8 i spróbuj ponownie",
  readFailed: "Nie udało się odczytać pliku",
};

const meta = {
  title: "Admin/Forms/FileImport",
  component: FileImportView,
  args: {
    accept: ".csv",
    label: "Wybierz plik CSV lub upuść go tutaj",
    hint: "Do 512 KB, UTF-8",
    onChooseFile: () => undefined,
  },
} satisfies Meta<typeof FileImportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Dragging: Story = { args: { dragging: true } };
export const FileChosen: Story = { args: { fileName: "proba.csv" } };
export const TooLarge: Story = { args: { error: messages.tooLarge } };
export const WrongEncoding: Story = { args: { error: messages.wrongEncoding } };
export const Disabled: Story = { args: { disabled: true } };

/** The stateful component: choose a real file to see the size and encoding checks. */
export const Interactive: Story = {
  render: () => (
    <FileImport accept=".csv" maxBytes={512 * 1024} label="Wybierz plik CSV lub upuść go tutaj" hint="Do 512 KB, UTF-8" messages={messages} onText={() => undefined} />
  ),
};
