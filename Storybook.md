# Storybook

Back to the [README](./README.md). Commands: `npm run storybook` (catalog on http://localhost:6006) and `npm run storybook:build` (static build in `packages/app/storybook-static`, part of the validation gate); see [GettingStarted.md](./GettingStarted.md).

Storybook 10 (`@storybook/nextjs-vite`) is configured in `packages/app/.storybook/` and renders components with the
app's real Tailwind + shadcn theme (`globals.css`). All stories live in `packages/ui/src/storybook/`, mirroring the
component path (`storybook/admin/button.stories.tsx` covers `admin/button.tsx`). They import types from
`@storybook/react` so `ui` stays free of Next.js. A component that lives only in `app` gets a story once it moves to `ui`. Use the toolbar to switch light/dark and the Accessibility
panel to check WCAG issues. Stories pass props only: no database, container or `server-only` imports.
