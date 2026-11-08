# Execution plan: rules recommendations, Phase 1 (E04-S01, #108)

Source doc: .ai/specs/2026-11-08-rules-engine-recommendations.md
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

- [ ] 1.1 db: return_rule_comparisons migration, entity, recordComparison in transition
- [ ] 1.2 core: recommend() and view schema
- [ ] 1.3 core: rules-recommendations flag parser
- [ ] 1.4 core: ReturnService wiring (detail view, transition passes recommendation) and Awilix registration
- [ ] 1.5 app: recommendation in agent payload, decision-card box, README env row
- [ ] 1.6 docs: platform-primitives, brief D17 and A04 note, decision file
