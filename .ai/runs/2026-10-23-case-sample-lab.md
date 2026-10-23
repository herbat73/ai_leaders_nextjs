# Execution plan: case sample lab and platform primitives

Source doc: .ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md
Engine: om-auto-create-pr (steps: 12, --loop: no)

## Goal
Build the E00-T01 case sample lab (`/admin/discovery/case-sample`) and the reusable primitives under it (Money, domain types, rules engine, metrics, tabular import, UI stat/rule/import components), as the spec's Implementation Plan describes.

## Scope
Phases 1–4 of the spec in one PR (the spec allows Phase 1 step 1 to ship earlier; here it is one commit series on one branch).

## Non-goals
Persistence, CLI, real order/mail ports, anything from the customer-portal spec, `addMoney`/`applyRate`.

## Risks
- `papaparse` must pass `npm run audit`.
- Manual curl/browser acceptance depends on the sandbox being able to run `next dev`.
- `ui` has no test runner; UI is verified by stories and typecheck.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Core primitives

- [x] 1.1 Domain types and Money
- [x] 1.2 Rules engine
- [x] 1.3 Metrics
- [x] 1.4 Tabular import

### Phase 2: Case sample backend

- [x] 2.1 Body cap and schemas
- [x] 2.2 CaseSampleService.analyze
- [x] 2.3 Note renderer
- [x] 2.4 Wiring and route

### Phase 3: UI primitives and the lab page

- [ ] 3.1 UI primitives
- [ ] 3.2 Lab page

### Phase 4: Close-out

- [ ] 4.1 Docs, run log and lessons
