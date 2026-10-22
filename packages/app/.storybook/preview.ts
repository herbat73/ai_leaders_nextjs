import type { Preview } from "@storybook/nextjs-vite";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../src/app/globals.css";

const preview: Preview = {
  // Same mechanism as ThemeToggle: the `dark` class on <html>.
  decorators: [withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light" })],
  parameters: {
    nextjs: { appDirectory: true },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  tags: ["autodocs"],
};

export default preview;
