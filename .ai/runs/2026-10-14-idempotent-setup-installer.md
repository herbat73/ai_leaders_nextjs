# Execution plan: idempotent `npm run setup` installer

Source doc: .ai/specs/implemented/2026-10-14-idempotent-setup-installer.md
Issue: #3 · Spec PR: #4

## Goal
`npm run setup` runs preflight, install, database start and migrations in one command, skips what is already done, and is safe to re-run. README leads with it and keeps the manual steps as the alternative.

## Scope
`scripts/setup.mjs`, root `package.json` script, README. Non-goals: dev server start, installing Node/PostgreSQL, seeding, Windows-native support, changes to `scripts/db.sh`, MikroORM config, migrations or app code.

## Implementation Plan
1. Scaffold the step runner and the `setup` script.
2. Preflight and install steps.
3. Database step.
4. Migration step.
5. README update (incl. env var name fix).
6. End-to-end verification and the full gate.

## Risks
The restated default-URL constant can drift from `packages/db/src/config.ts`; `db:migration:pending` output semantics are unverified (fallback: always run `db:migrate`). The repo has no test runner, so verification is manual.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Installer script and README

- [x] 1.1 Scaffold the script — 267ee16
- [x] 1.2 Preflight and install steps — 267ee16
- [x] 1.3 Database step — 267ee16
- [x] 1.4 Migration step — 267ee16
- [x] 1.5 README — 0731da2
- [x] 1.6 End-to-end verification and gate — d34a977
