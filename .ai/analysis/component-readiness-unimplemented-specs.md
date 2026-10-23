# 🧩 Component readiness for the unimplemented specs

Audited 2026-10-23 against `packages/ui/src` (what exists today) and the four pending specs. Read-only; complements the two existing `pre-implement-*` reports. Specs not touched.

Existing components: `admin/{badge,button,card,input,label,table}`, `admin/feedback/{empty-state,error-message,loading-message}`, `admin/forms/crud-form`, `admin/tables/data-table`, `admin/api/api-call`, `public/return-request-form`, `theme-toggle`. Badge variants: default, secondary, destructive, outline. `ui` has no Radix dependency besides `react-slot`.

## ⛔ Blocking

| # | Spec | Finding | Recommendation |
|---|------|---------|----------------|
| B1 | Return agent decision | Spec says "list and card reuse existing components", but the **timeline** (events list on the decision card) and the **reject note field with live counter** have no component: there is no `Textarea`, no `Timeline`. The case-sample catalog lists `Timeline` (`ui/src/admin/timeline/`) as "design" with B-02 and K-05 as consumers, so ownership is undecided and two specs could each build one. | Add a Phase 2 step to the agent spec: "build `Timeline` in `ui/src/admin/timeline/` (props: `events: { id, label, actor, at, note? }[]`, ordered list, story per state) and `Textarea` via `npx shadcn@latest add textarea`". Mark `Timeline` as "this spec" in the case-sample catalog; the portal tracker then reuses it with a public variant. |
| B2 | Return agent decision | The prerequisite "Test runner (N4)" is **already done** (commit `be8c37a`, Vitest in `@easyrms/core`, `npm test` in the gate). Phasing and the plan still list it as a pending PR; an implementer would redo or block on it. | Delete the prerequisite section and the N4 risk line; state that `core` tests exist and `app`/`ui` have none. |
| B3 | Return customer portal | The wizard, status tracker, stepper and evidence UI are **all unbuilt** and the spec only says "Tailwind components in `ui/src/public/returns/`". `ui/src/public` holds one component with no shared Tailwind primitives (input, button, radio/choice group, textarea, banner), so the first step would invent the public primitive set implicitly. Admin primitives are shadcn-styled and AGENTS.md forbids using them on public pages. | Add a step before the wizard: "public Tailwind primitives" (`Field`, `TextInput`, `Textarea`, `ChoiceGroup` radio cards, `Banner`, `Stepper` with `aria-current="step"`, `StageList` for the tracker) in `ui/src/public/`, each with a story in `ui/src/storybook/public/`. List props in the spec. `Wizard`/`StatusTracker` are "design" in the case-sample catalog, so say the portal spec owns them. |
| B4 | Return customer portal | Money, date and plural formatting for the Polish UI has no home: `ui` cannot import `core`, and `formatMoney` for `ui` is only "design" in the case-sample catalog. The quote response is `{ amount, currency, fee }` raw. | Decide in the spec: either the API returns pre-formatted pl-PL strings, or add `ui/src/lib/format.ts` (`formatMoney`, `formatDate`, `pluralPl`) as a portal step with unit tests. This requires a `ui` test runner, which does not exist (see B5). |
| B5 | Portal, agent, case-sample | Component acceptance is "manual" in all three specs; `ui` and `app` have no test runner, and pure helpers placed in `ui` (formatters, counter logic, stage mapping) cannot be unit-tested. | Keep logic that needs tests in `core` (stage mapping, reject-note validity, plural helper) and pass results as props, or get owner approval for Vitest in `ui` as a prerequisite step. State the choice once in the engineering standards. |
| B6 | Case-sample lab | `DataTable` gets a `caption` prop and "kept when the table is empty", but the current `DataTable` returns `EmptyState` early and never renders a table when `rows` is empty. The spec already flags this as G2 in its analysis; it is a component change, not an additive prop. | Specify the behavior: with `caption` and empty rows render `<table><caption>…</caption></table>` plus `EmptyState`, without `caption` unchanged. Add a story for both. |

## ⚠️ Important

- **Language.** All three specs say "Copy language: English"; the app is now Polish-only (see the portal analysis). Every new component's story and default props (`DataTable` default `emptyMessage`, "Overdue", "What now?") must be Polish. Existing components with English defaults need a pass: `DataTable.emptyMessage`, `LoadingMessage`, `ErrorMessage`, `CrudForm` labels. Recommend one shared copy convention: components take all text via props, no hard-coded default strings in `ui`.
- **Overdue marker (agent spec).** "Red Overdue" maps to `Badge variant="destructive"`; fine. The `?status=` filter needs link-style tabs (Next `Link` cannot live in `ui`, which is Next-free): accept an `href` render prop or a `renderLink` slot, or colocate the filter in `app`. Decide in the spec.
- **`FileImport` (case-sample).** The drop zone is a `<button>` plus hidden `<input type=file>`; confirm it uses plain shadcn `Button`/`Input` styling and has a story per state (idle, drag-over, disabled, error). No Radix dependency is needed.
- **shadcn additions.** `Textarea` (agent, portal) is a plain element, no new dependency. Anything with Radix (`Dialog`, `Select`, `RadioGroup`, `Sheet` for B-05 `RuleBuilder`) adds a package to `ui`; keep those out of the current specs and run `npm run audit` after any add.
- **Three overlapping catalog entries.** `Timeline`, `StatusTracker`, `Wizard` appear as "design" in the case-sample catalog but are needed sooner by the agent and portal specs. Update the catalog statuses when B1 and B3 are applied so the catalog does not mislead.

## ✅ No action

Case-sample primitives (`StatTile`, `StatRow`, `BreakdownTable`, `RuleSummary`, `FileImport`) do not duplicate anything that exists and sit in categories the standards allow. Reused `Card`, `Badge`, `Button`, `Input`, `Label`, feedback components, `apiCall` all exist with the props the specs rely on. `engineering-standards` and `idempotent-setup-installer` specs involve no UI components.

## Suggested order

1. Agent spec: fix B1, B2 (small, unblocks Phase 2).
2. Case-sample spec: fix B6 and the `Timeline` status line.
3. Portal spec: decide B3, B4, B5, then the Polish copy convention above.
