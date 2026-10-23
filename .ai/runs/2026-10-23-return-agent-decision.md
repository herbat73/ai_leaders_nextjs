# Execution plan: return agent decision

Source doc: .ai/specs/2026-10-22-return-agent-decision.md

## Goal
Replace the unconstrained status select on `/admin/returns` with a nine-status workflow: enforced state machine, RMA numbers, per-request timeline, inbox with a two-business-day due marker, and a decision card. The public form keeps working.

## Scope
`core` (state machine, calendar, RMA, service, validators, `apiHandler` logging), `db` (entities, migration, repository, DB test runner), `app` (routes, admin pages), `ui` (`Textarea`, `Timeline`). Non-goals: customer portal, agent auth, rules engine, carrier integration, any change from the case-sample lab spec.

## Risks
- Single-migration status rewrite is forward-only after first agent use (P2).
- DB suite (P5) runs outside CI; result recorded in `.ai/runs/` per PR.
- No agent authentication (AD-A2): blocker recorded in Phase 2 step 4.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Status model and timeline

- [x] 1.1 core: `defineStateMachine` with tests — 66c984d
- [x] 1.2 core: `addBusinessDays`/`dueAt`/`overdue` with tests — b9ad226
- [x] 1.3 core: `formatRma`, `toReturnStatus`, `formatEventTime` with tests — b9ad226
- [ ] 1.4 core: `ConflictError` fields and `apiHandler` 500-path logging (P8) with tests
- [ ] 1.5 core: nine-status model, transition table, schema, port, service, fake and tests
- [ ] 1.6 db: entities and the hand-written migration with `down` and snapshot
- [ ] 1.7 db: repository (`transition`, `findDetail`, `findStatus`, `list`, create) and logger wiring
- [ ] 1.8 app: routes, admin page, badge map and restricted status actions
- [ ] 1.9 db: `test:db` runner and Postgres tests (P5), AGENTS.md and README entries
- [ ] 1.10 scripted Postgres run and run log (merge gate)

### Phase 2: Inbox and card

- [ ] 2.1 ui: `Textarea` and `Timeline` with stories
- [ ] 2.2 app: inbox with RMA, due marker and status filter
- [ ] 2.3 app: decision card with timeline and reject note
- [ ] 2.4 close-out: blocker in product brief, README, lessons, spec to `implemented/`
