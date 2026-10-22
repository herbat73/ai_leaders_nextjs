import type { StorybookConfig } from "@storybook/nextjs-vite";

/** Lives in `app` because the Next.js framework, PostCSS/Tailwind and `globals.css` are here; stories are colocated. */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../../ui/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};

export default config;
