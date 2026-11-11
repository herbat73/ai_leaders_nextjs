# Execution plan: evidence retention and erasure (T-21)

Source doc: .ai/specs/2026-11-11-evidence-retention-and-erasure.md (spec PR #147, design-only; Refs #145)

## Goal
After `EASYRMS_RETENTION_DAYS` (default 365) a closed request has its photos and audit rows deleted and its personal text anonymized in place; an operator can erase one request on demand.

## Scope
`core` (setting parser, `RetentionService`, `RetentionPort`), `db` (migration `anonymized_at`, `RetentionRepository`), `app` (`scripts/retention.ts`, `retention:run`, `retention:erase`, DI), agent decision card "Zanonimizowano" state, docs (Configuration.md, runbook, threat model T-21, brief R16/Q23).
Final statuses (from the three state machines): `resolved`, `rejected`, `cancelled`.

## Non-goals
HTTP route, in-app scheduler, admin button, deleting request rows, backups, supplier mail already sent, photos in claim mail.

## Risks
Irreversible deletion (dry run, 30-day floor, final-status rule, per-request transaction). Docker is not running on the build machine, so `npm run test:db` may not run; stated in the PR if so. Assumptions Q2, Q3, Q8 are unconfirmed defaults.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Retention core and job

- [ ] 1.1 core: parseRetentionDays
- [ ] 1.2 db: migration anonymized_at and RetentionRepository
- [ ] 1.3 core: RetentionService.run
- [ ] 1.4 app: retention script, DI and Configuration.md

### Phase 2: Erasure request and visibility

- [ ] 2.1 core and app: eraseOne and retention:erase
- [ ] 2.2 app: anonymized state on the decision card and tracker 404
- [ ] 2.3 docs: runbook, threat model, brief, QA scenario
