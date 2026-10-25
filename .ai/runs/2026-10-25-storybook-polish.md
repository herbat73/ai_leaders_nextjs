# Storybook polish — admin docs pages match the component source

## Goal

Make the Polish docs pages of the admin components (`packages/ui/src/storybook/admin/**/*.mdx`) state only what the component source does.

## Scope

A scripted audit of every admin docs page (its `## Tokeny` classes against the component source, and the eight required sections in order) found four stale claims left over from the mockup-theme commit (42164b5):

- `tabs.mdx`: inactive tab is `text-secondary-foreground` (hover `text-foreground`), not `text-foreground/60`.
- `table.mdx`, `tables/data-table.mdx`, `stats/breakdown-table.mdx`: row hover is `hover:bg-background`, not `bg-muted/50`.

All other pages pass; section order and presence are intact.

## Non-goals

No component, token or story changes; no public-component docs; no new sections; `Dialog` `shadow-lg` vs `--shadow-overlay` left as is.

## Base

Branched from `feat/storybook_polishing` (42164b5, not yet in `main`) because the claims describe that theme; the PR targets that branch so its diff holds only this run.

## Risks

Docs only; `docs:check` and `storybook:build` do not verify class claims, so the audit is manual.

## Progress

PR: #34

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Correct stale token claims

- [x] 1.1 Fix inactive-tab colour in tabs.mdx — 02737a6
- [x] 1.2 Fix row hover in table, data-table and breakdown-table pages — 02737a6
