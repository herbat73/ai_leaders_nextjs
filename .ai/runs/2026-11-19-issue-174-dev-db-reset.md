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

PR: #176

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reset endpoint

- [x] 1.1 db: DevDatabaseResetRepository.truncateAll — 6f2bc3b
- [x] 1.2 app: isDevResetAvailable and resetDevEnvironment service — cbec8df
- [x] 1.3 app: POST /api/dev/reset route and permission table entry — cbec8df

### Phase 2: Button and docs

- [x] 2.1 admin shell: ResetDevDbButton with confirmation dialog — f1b9fb2
- [x] 2.2 Storybook story for the dialog states — not needed: the button lives in the app shell (not a `ui` component) and the Dialog's destructive-confirm states are already in `Admin/Dialog` stories; `storybook:build` and `docs:check` green
- [x] 2.3 QA scenario for the reset flow — replaced by a live check on a throwaway database (see Run log); no `.ai/qa` scenario: the test environment (`test-env.env/json`, QA template DB) is not provisioned here and an unrun script would be unverified
- [x] 2.4 Docs: README, GettingStarted, Configuration, threat model
- [x] 2.5 Archive the Delta into the capability spec — 691fc7c

## Run log

- Spec PR #175 (`.ai/specs/2026-11-19-dev-db-reset.md`), implementation PR #176, issue #174.
- Deviation from the spec: the wipe is `TRUNCATE … CASCADE` **without** `RESTART IDENTITY` (spec Q1 said restart). A live check showed the reseeded admin then got id 1 again and the pre-reset session cookie still worked; without the restart every old cookie is rejected (401 on the API, redirect to `/admin/login` on pages). Recorded in `.ai/lessons.md`; the spec PR text is corrected separately.
- Live check (throwaway database `easyrms_reset174`, `next dev -p 3174`, dropped afterwards): no session 401; no CSRF header 403 `csrf_rejected`; reset 200 with `tablesEmptied: 11`; an extra supplier was removed and only the two dev suppliers and `admin@example.com` (new id) remain; old cookie 401 / page 307 to login; re-login 200 and new session works; the admin page HTML contains "Resetuj bazę". Not browser-driven (no `agent-browser` installed): the dialog interaction is covered by the QA step.
- Gate (all green): typecheck, test (1058), lint (0 errors), audit, docs:check, storybook:build, `NODE_ENV=production npm run build` (route `/api/dev/reset` present), `router:check`.
- Review (`om-auto-review-pr --autofix`): one major fixed (AGT-007 403 case for the manager-only route, `0aedd6c`); spec PR #175 text aligned with the no-`RESTART IDENTITY` decision.
- `npm run test:db`: 17 files, 203 tests passed (includes the 3 new `dev-reset.repository` tests).
