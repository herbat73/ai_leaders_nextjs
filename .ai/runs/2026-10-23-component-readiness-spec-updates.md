# Run: component readiness audit and spec updates (2026-10-23)

**Attempted:** audited `packages/ui/src` against the pending specs (agent decision, customer portal, case-sample lab), then applied the recommendations to the specs.

**Changed (spec text only, nothing committed, no gate run):**
- `2026-10-22-return-agent-decision.md`: N4 marked already done (`be8c37a`), prerequisite PR removed; `Textarea` and `Timeline` added with a Phase 2 step; filter links built in `app`; Polish copy.
- `2026-10-22-case-sample-lab-and-platform-primitives.md`: `DataTable` `caption` empty-state behavior specified; catalog statuses updated (`Timeline`, `Wizard`, `StatusTracker`, public primitives); `ui` `formatMoney` dropped in favor of `core`; Polish copy.
- `2026-10-22-return-customer-portal.md`: public Tailwind primitive set and a Phase 2 step 1; N5 (formatting in `core`/`app`, no Vitest in `ui`); quote response returns pre-formatted strings; `lang="pl"`; Polish copy.
- Report: `.ai/analysis/component-readiness-unimplemented-specs.md`.

**Open:** Polish-only decision confirmed and recorded as D07 in the product brief (N04 restored to the English-version non-goal); non-component blockers in `pre-implement-return-customer-portal.md` (lookup contract, `Set-Cookie`, CSRF check, DB test oracle) not applied.
