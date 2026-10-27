# `@easyrms/ui`

Reusable components: shadcn/ui-based admin (`src/admin/`) and Tailwind-based public (`src/public/`). No business logic or
data access; components receive data through props. Imports nothing internal.

## Design system (Storybook is the manual)

- Before building or changing any screen read `src/storybook/agent/dla-agenta-ai.mdx` (component picker, allowed tokens,
  forbidden list) and copy a skeleton from `src/storybook/patterns/ekrany.stories.tsx`.
- Every component has a docs page `src/storybook/<component path>.mdx` (Polish; sections Kiedy użyć, Kiedy nie użyć, Jak
  złożyć, Tokeny, Stany, Dostępność, Rób i nie rób, API) next to its stories. Read it before using the component.
- Colours come only from the semantic tokens in `src/styles.css` (never palette classes, hex, `text-white`, or `dark:`
  for token colours). A new token or component updates its docs page in the same change.
- `npm run docs:check` fails on a component without story/page/sections and on raw palette colours.

## Components and stories

- Placement: shadcn primitive → `src/admin/` (via `npx shadcn@latest add`); generic pattern → `src/admin/<category>/`;
  concept-specific → `src/{admin,public}/<concept>/`; used by one page → colocate until a second page needs it.
- Reuse the shared layer: `admin/api/api-call.ts` (the only sanctioned `fetch('/api/*')` site), `admin/forms/crud-form.tsx`,
  `admin/tables/data-table.tsx`, `admin/feedback/*`.
- Every reusable component ships a `*.stories.tsx` covering its states. Stories live in `src/storybook/`, mirroring the
  component path (`storybook/admin/button.stories.tsx` for `admin/button.tsx`), never next to the component. Import from
  `@storybook/react`, never `@storybook/nextjs-vite`, to keep `ui` Next-free.
- `ui` has no test runner yet; `npm run storybook:build` is in the gate.
