# Storybook for the Next.js app and the shared UI package

Status: implemented 2026-10-22.

## 📝 TLDR
Developers and agents building UI need a way to render components in isolation, in every state, in light and dark,
without a database or a running app. Before this change, `packages/ui` had 13 components and no way to see them
outside a page, and UI acceptance in every spec was "manual". Now: Storybook 10 with the Next.js (Vite) framework renders
`ui` primitives (and, later, the app's colocated client components) with the app's real Tailwind 4 + shadcn theme. It
has an Accessibility panel, a light/dark switch and a static build in the validation gate. Specs name stories as their
UI acceptance artifacts.

## 📝 Resolved decisions
Owner accepted all recommendations on 2026-10-22:

| Id | Decision |
|---|---|
| Q1 | `@storybook/nextjs-vite` (Vite; mocks `next/navigation`, `next/image`, `next/font`; supports Next 16) |
| Q2 | Config in `packages/app/.storybook/`; scripts at the root. Stories were first colocated; on 2026-10-22 the owner moved all of them to `packages/ui/src/storybook/`, mirroring component paths |
| Q3 | `ui` stories import types from the renderer `@storybook/react` (keeps `ui` Next-free); `app` stories use `@storybook/nextjs-vite` |
| Q4 | Built-ins + `@storybook/addon-docs` (autodocs) + `@storybook/addon-a11y` + `@storybook/addon-themes`; `addon-vitest` deferred |
| Q5 | `npm run storybook:build` added to `validation.commands` |
| Q6 | A story file for every existing `ui` component |
| Q7 | Specs name stories as UI acceptance (applied to the case-sample spec, Phase 3 step 1) |

## 📝 What was built
- **Versions:** all Storybook packages at 10.6.3 (exact), with `vite` 8.2.4. Storybook < 10.6.2 is affected by
  GHSA-f2ph-cmg5-wxc8 (critical: missing origin validation in the preview), so 10.6.1 was rejected even though it is older.
- **Packages:** `packages/app` devDependencies: `storybook`, `@storybook/nextjs-vite`, the three addons,
  `eslint-plugin-storybook`, `vite`. `packages/ui` devDependencies: `storybook`, `@storybook/react`.
- **`.storybook/main.ts`:** one stories glob, `ui/src/storybook/**`; addons; `staticDirs: ["../public"]`; telemetry disabled.
- **`.storybook/preview.ts`:** imports `src/app/globals.css` (Tailwind 4 + `@easyrms/ui/styles.css` + `@source` for `ui`);
  `withThemeByClassName({ light: "", dark: "dark" })`, the same `dark` class `ThemeToggle` uses; `nextjs.appDirectory`;
  `autodocs` tag.
- **Scripts:** root `storybook` (dev, port 6006) and `storybook:build` (to `packages/app/storybook-static/`, gitignored).
- **ESLint:** `eslint-plugin-storybook` `flat/recommended`. `storybook/no-renderer-packages` is turned off for
  `packages/ui/src/storybook/**` only, because Q3 deliberately uses the renderer package there.
- **TypeScript:** `packages/app/tsconfig.json` includes `.storybook/**/*.ts` (TypeScript wildcards skip dot-directories).
- **Stories (13 files, 34 stories):** `Badge`, `Button`, `Card`, `Input`, `Label`, `Table`, `DataTable` (rows, empty,
  loading, error), `CrudForm` (default, client validation, server errors, no cancel), `EmptyState`, `ErrorMessage`,
  `LoadingMessage`, `ReturnRequestForm` (success, field errors, network failure), `ThemeToggle`. Callbacks use typed
  `fn<…>()` from `storybook/test`.
- **Docs:** README "Storybook" section and commands; `AGENTS.md` command list and story rule; engineering standards §2
  ("every reusable `ui` component ships a story").

## 📝 Limits and follow-ups
- Accessibility checks are interactive (panel) only. Failing the gate on violations needs `@storybook/addon-vitest` +
  Playwright (Q4b, deferred).
- Stories cover `ui` components only (`ui` cannot import `app`). An `app` component gets a story once it moves to `ui`;
  components that call `apiCall` then get a mocked `fetch` per story (MSW only if that becomes repetitive).

## 📋 Verification (2026-10-22)
- `npm run typecheck` ✓, `npm test` ✓, `npm run lint` ✓ (0 errors; the 86 warnings are the same as on `main`, all in the
  concept mockup), `npm run storybook:build` ✓ (34 stories; the built CSS contains `ui` classes and the `.dark` variant),
  `storybook dev` serves `index.json` and story iframes.
- `npm run audit` and `NODE_ENV=production npm run build` first failed (on `main` too) because of Next.js advisories
  GHSA-2464-fhr4-w9xw (critical) and GHSA-p3m5-59mp-jv5r (high); `next build` aborted with `SecurityFatalError`. Fixed in
  the same change set by upgrading `next` and `eslint-config-next` to 16.4.1; the full gate is now green.
- Not done: a visual check in a real browser. Rendering was confirmed by a successful build and the dev server serving
  the story iframes; run `npm run storybook` to look.
