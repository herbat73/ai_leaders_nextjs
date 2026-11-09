# Execution plan: rules recommendations, Phase 1 (E04-S01, #108)

Source doc: .ai/specs/implemented/2026-11-08-rules-engine-recommendations.md
Issue: #108 (Closes), epic #31 (Refs). Spec PR: #111 (merged).

## Goal
With `EASYRMS_RULES_RECOMMENDATIONS=on`, the agent's decision card shows the R08/R09 recommendation and every approve/reject decision records a `return_rule_comparisons` row. Nothing is automatic; customers see no change. Flag off (default): no field, no UI, no row.

## Scope
`db` (migration, entity, repository write inside `transition`), `core` (`recommend()`, flag parser, service wiring), `app` (container, payload, decision-card box, README), docs.

## Non-goals
Inbox badges (#109), rules page (#110), R10a/R10b, configurable thresholds, automatic approval, moving the spec to `implemented/`.

## Risks
`test:db` needs the Docker Postgres on 5433 (see lessons); record its result in `.ai/runs/`. Migration is additive; `down` drops the table.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Recommendation and comparison

- [x] 1.1 db: return_rule_comparisons migration, entity, recordComparison in transition — b63407f
- [x] 1.2 core: recommend() and view schema — 3018785
- [x] 1.3 core: rules-recommendations flag parser — 3018785
- [x] 1.4 core: ReturnService wiring (detail view, transition passes recommendation) and Awilix registration — 3018785
- [x] 1.5 app: recommendation in agent payload, decision-card box, README env row — d1c63ff
- [x] 1.6 docs: platform-primitives, brief D17 and A04 note, decision file — d1c63ff

## Outcome

- Gate (worktree): `typecheck`, `npm test` (811 passed), `lint` (0 errors, 86 existing warnings), `audit`, `docs:check`, `storybook:build`, `NODE_ENV=production npm run build`: all green.
- `npm run test:db` against the Docker Postgres on 5433: 133 passed (new: 5 repository tests for the comparison write incl. rollback with the decision, 2 migration tests incl. `down` refusing once rows exist).
- Not exercised: the running app with the flag on (needs-qa, see PR).
- Deviations from the spec: none. `recommendation` is read only in `ReturnService.getDetail` (the page); no API payload carries it because no `GET /api/returns/[id]` exists.
