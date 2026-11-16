# Issue #158 — admin login link on the main page in the dev environment

Issue: https://github.com/herbat73/ai_leaders_nextjs/issues/158
Engine: om-auto-create-pr (steps: 3, --loop: no)

## Goal

On the customer lookup page (`/`), show a link to `/admin/login` in the top right corner, just left of the light/dark
switch, only outside production.

## Scope

- `packages/app/src/app/_lookup/admin-login-link.tsx`: Server Component, renders `null` when `NODE_ENV === "production"`;
  fixed `top-4 right-16` so it sits left of `ThemeToggle` (`fixed right-4 top-4`, 36 px wide). Tailwind only (public page).
- Pure helper `showAdminLoginLink(nodeEnv)` in `_lookup/admin-login-link.ts` so the rule is unit-testable (app tests are `*.test.ts`, node env).
- Polish copy in `_lookup/copy.ts`.
- Rendered on `LookupPage` only (the issue says "main page").

## Non-goals

- No change to `ThemeToggle`, auth, `proxy.ts` or `/admin/login`. No env var: "dev environment" = `NODE_ENV !== "production"`,
  the same rule `DevSamples` already uses.

## Risks

- Link visible in `next dev` and in any non-production `NODE_ENV` (e.g. `test`); accepted, matches `DevSamples`.
- Fixed positioning could overlap the title on a very narrow screen; the page has a 16 px top padding of 64 px (`py-16`) so the header clears it.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dev-only admin login link

- [ ] 1.1 Add `showAdminLoginLink` helper, copy and link component, render it on the lookup page
- [ ] 1.2 Unit test for the visibility rule
- [ ] 1.3 Document in `Configuration.md`/README if dev-only UI is listed there, run the full gate
