import type { StorybookConfig } from "@storybook/nextjs-vite";
import remarkGfm from "remark-gfm";

/** Lives in `app` because the Next.js framework, PostCSS/Tailwind and `globals.css` are here; all stories and docs pages (MDX) live in `ui/src/storybook`. */
const config: StorybookConfig = {
  stories: ["../../ui/src/storybook/**/*.@(mdx|stories.@(ts|tsx))"],
  addons: [
    // GFM: the docs pages use markdown tables.
    { name: "@storybook/addon-docs", options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } } },
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
  ],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  // MDX pages in `ui` import `@storybook/addon-docs/blocks`, which is installed only in `app`. Resolve it (and the docs
  // theme context it shares with the preview) from `app`, or the blocks render without a theme and crash.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: { ...viteConfig.resolve, dedupe: [...(viteConfig.resolve?.dedupe ?? []), "@storybook/addon-docs"] },
  }),
};

export default config;
