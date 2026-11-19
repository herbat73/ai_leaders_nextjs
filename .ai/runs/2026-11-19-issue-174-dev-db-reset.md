# Execution plan: issue-174-dev-db-reset

Source doc: .ai/specs/2026-11-19-dev-db-reset.md (spec PR #175; the spec file is not committed on this branch)
Issue: #174

## Goal
A "Resetuj bazę" button at the top left of the admin header that, after confirmation, truncates all data tables and reseeds the dev suppliers and admin. Available only when `NODE_ENV=development` and the DB host is loopback.

## Scope
`db` repository (truncate), app service + route `POST /api/dev/reset`, admin shell client button with shadcn Dialog, tests, docs, capability archive.
Non-goals: schema changes, new env vars, CLI `db:reset`, hosted dev DB opt-in, Server Actions.

## Risks
Destructive; guarded by environment + loopback host + `MANAGE_RULES` + CSRF + confirm. `test:db` needs Docker.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reset endpoint

- [x] 1.1 db: DevDatabaseResetRepository.truncateAll — 6f2bc3b
- [x] 1.2 app: isDevResetAvailable and resetDevEnvironment service — cbec8df
- [x] 1.3 app: POST /api/dev/reset route and permission table entry — cbec8df

### Phase 2: Button and docs

- [ ] 2.1 admin shell: ResetDevDbButton with confirmation dialog
- [ ] 2.2 Storybook story for the dialog states
- [ ] 2.3 QA scenario for the reset flow
- [ ] 2.4 Docs: README, GettingStarted, Configuration, threat model
- [ ] 2.5 Archive the Delta into the capability spec
