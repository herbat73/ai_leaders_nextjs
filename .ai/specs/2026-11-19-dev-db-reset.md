# Reset the dev database from the admin header

Refs: issue #174; dev seed data `.ai/specs/implemented/` (PR #157, issue #156, `packages/app/src/server/dev-seed.ts`).

## 📝 TLDR
Developers who click through the back office fill the local database with returns, claims and test agents, and the only way back to the starting state today is to recreate the database by hand and rerun `npm run setup`. Proposed (future behavior): in a development environment only, a "Resetuj bazę" button at the top left of the admin header asks "Czy chcesz zresetować bazę do pierwotnego stanu developerskiego?" and, after confirmation, empties every application table and reseeds the dev suppliers and the dev admin, then sends the developer to the login page.

## 📝 Resolved assumptions (autonomous defaults)
The issue leaves these open. Each is resolved to the smallest, most reversible, safest option; override any on the PR before merge.

| # | Question | Chosen answer | Why |
|---|---|---|---|
| Q1 | What does "reset" do to the schema? | Truncate all data tables (`TRUNCATE … CASCADE`, identities **not** restarted), keep the schema and `mikro_orm_migrations`; no drop, no migration rerun. | Fast, needs no DDL right while the pool is in use, and the schema is already what the code expects. Identities are not restarted on purpose: the session cookie carries the agent id and epoch, so a reseeded admin with the same id (1) would keep every pre-reset cookie valid (found in the live check of the implementation). |
| Q2 | What are "initial settings"? | The state `npm run seed:dev` produces today: the two dev suppliers and the dev admin `admin@example.com`. The app keeps no settings in the database (rules, limits and windows come from code and environment variables), so there is nothing else to restore. | Reuses `seedDevData` instead of a second seed definition. |
| Q3 | Where is the reset allowed? | Only when `NODE_ENV` is `development` **and** the database host is a loopback address (`localhost`, `127.0.0.1`, `::1`). Anywhere else the route answers 404 and the button is not rendered. | The seed's refusal in production is not enough for an operation that deletes everything: a developer's `.env` pointing at a shared or staging database must not be wipeable from a button. A hosted dev database needs a later, explicit opt-in. |
| Q4 | Who may call it? | An agent with `MANAGE_RULES` (the permission the dev admin has). | It deletes all agents and all customer data, so a plain agent must not. |
| Q5 | What happens to the signed-in session? | The current agent is deleted and reseeded under a new id, so the session ends; after success the UI goes to `/admin/login` (the existing stale-cookie path: `getCurrentAgent` loads the agent from the database and finds none). The login page is not changed. | No new session mechanism; the dev admin credentials are the documented ones. |
| Q6 | Confirmation UI | The shadcn `Dialog` already in `@easyrms/ui/admin`, with the issue's Polish question and "Resetuj" / "Anuluj"; no typed confirmation. | One click plus one confirm is what the issue asks; a typed phrase is easy to add. |
| Q7 | Placement | First element of the admin header, left of the navigation. | "Top left corner" in the issue. |
| Q8 | Anything outside the database? | Out of scope: evidence photos live in `evidence_files` (bytea), so they are covered; browser cookies of customers and the Postgres throttle (`rate_limit_windows`, a table) are cleared with the rest. | No file store or cache exists to reset. |

## 📝 Problem Statement
`npm run setup` seeds a fresh checkout once (PR #157), and `seed:dev` is idempotent: it never overwrites what exists. A developer or QA run that wants a clean slate has no supported command, so they drop the Postgres volume or the database by hand (the QA scripts do their own template-database copy for the same reason, see `.ai/lessons.md` 2026-11-16). The cost is minutes per reset and the risk of resetting the wrong database.

## 📝 Proposed Solution
A single POST route, `/api/dev/reset`, that runs: truncate all data tables in one transaction under a Postgres advisory lock, then `seedDevData`. The admin header gets a client button that calls it through `apiCall`. The server decides availability (`isDevResetAvailable`), the shell only renders the button when it is true, and the route re-checks it (the button is convenience, the route is the guard).

Alternatives that lost: dropping and recreating the schema then running migrations (DDL on a live pool, slow, needs the migrator inside the web process); a CLI `npm run db:reset` only (does not give the in-app button the issue asks for; it can reuse the same repository later); reseeding without truncating (cannot remove test data, which is the point).

## 📝 Delta

### Capability: dev-environment-reset

#### ADDED Requirement: Reset button only in a development environment
The system SHALL show the "Resetuj bazę" button in the admin header only when `NODE_ENV` is `development` and the configured database host is a loopback address, and SHALL answer `POST /api/dev/reset` with 404 in every other case.

##### Scenario: Production or remote database
- WHEN the process runs with `NODE_ENV=production`, or `EASYRMS_DATABASE_URL` points at a non-loopback host
- THEN the admin header has no reset button and `POST /api/dev/reset` returns 404 without touching the database

##### Scenario: Local development
- WHEN a signed-in agent with `MANAGE_RULES` opens any admin page under `next dev` against the default local database
- THEN the button is the first item at the left of the header

#### ADDED Requirement: Reset needs confirmation and permission
The system SHALL run the reset only after the agent confirms "Czy chcesz zresetować bazę do pierwotnego stanu developerskiego?" and only for an agent with `MANAGE_RULES`.

##### Scenario: Cancel
- WHEN the agent clicks the button and then "Anuluj"
- THEN no request is sent and the data is unchanged

##### Scenario: Agent without permission
- WHEN an agent without `MANAGE_RULES` (or no agent, or a request without the CSRF header) calls `POST /api/dev/reset`
- THEN the answer is 403 (401 without a session, 403 `csrf_rejected` for CSRF) and the data is unchanged

#### ADDED Requirement: Reset restores the seeded dev state
The system SHALL, on a confirmed reset, delete all rows of every application table and then seed the dev suppliers and the dev admin exactly as `npm run seed:dev` does, and SHALL send the agent to the login page.

##### Scenario: Reset after use
- WHEN returns, claims, evidence and an extra agent exist and the agent confirms the reset
- THEN only the two dev suppliers and `admin@example.com` remain, the old session no longer opens the back office, and logging in with the dev admin password works

##### Scenario: Seed fails after the wipe
- WHEN the truncate succeeds and the seed throws
- THEN the answer is 500 with a message to run `npm run seed:dev`, and the failure is logged with no secret in it

## 📝 Architecture
Dependency direction is kept (`app → db`, `core` untouched except one test table entry):

- `db`: `DevDatabaseResetRepository.truncateAll()` in `packages/db/src/repositories/dev/` (the concept folder `dev`, created with its first file). It takes `pg_advisory_xact_lock`, reads the table names from `information_schema.tables` for the schema (excluding `mikro_orm_migrations`), and issues one `TRUNCATE … CASCADE` inside a transaction. Reading the table list instead of hard-coding it means a new table is wiped without touching this code. All SQL stays in `db`.
- `app/server`: `dev-reset.ts` holds `isDevResetAvailable({ nodeEnv, databaseUrl })` and `resetDevEnvironment(deps)`, which checks availability, calls the repository, then `seedDevData` (existing, unchanged). Registered in the Awilix container as `devResetService`; the route and the shell resolve it from the container.
- `app/api/dev/reset/route.ts`: thin, `apiHandler` with `authenticate: requireAgent`, `permission: "MANAGE_RULES"`, throws `NotFoundError` when not available. Entry added to `ROUTE_PERMISSIONS` in `packages/core/src/http/agent-routes.coverage.test.ts`.
- `app/admin/_shell`: `admin-shell.tsx` (server) calls `isDevResetAvailable` and renders `ResetDevDbButton` (client island, `"use client"`, calls `apiCall("/api/dev/reset", { method: "POST" })`, same pattern as `LogoutButton`). Copy goes to `copy.ts`.
- No Server Action, no new dependency, no new environment variable, no schema change.

The loopback check parses the URL with `new URL`; an unparsable `EASYRMS_DATABASE_URL` counts as not available.

## 📝 UI/UX
- Button "Resetuj bazę", `variant="outline"`, small, left of the navigation. Clicking opens a dialog: title "Reset bazy", text "Czy chcesz zresetować bazę do pierwotnego stanu developerskiego?", actions "Resetuj" (destructive) and "Anuluj". Focus starts on "Anuluj"; Escape cancels.
- While running: "Resetowanie…", both actions disabled. Success: `router.replace("/admin/login")` then `router.refresh()`. Failure: `role="alert"` text "Nie udało się zresetować bazy. Uruchom `npm run seed:dev`." and the dialog stays open.
- The button is not rendered outside development, so production users see no change.

## 📝 Edge Cases & Failure Scenarios
- **Wipe succeeds, seed fails:** the database is empty and nobody can log in. The error says so and names the recovery (`npm run seed:dev`); the transaction cannot span the seed because `seedDevData` uses the services' own transactions.
- **Two resets at once:** the advisory lock serializes them; the second one waits and then wipes again (harmless).
- **Requests in flight (customer form, another agent):** `TRUNCATE` waits for row locks and then those requests fail or see no data; acceptable on a dev database; the dialog keeps the issue's wording.
- **Shell rendered, route disabled** (e.g. env changed between): 404 shows the failure text; nothing is deleted.
- **A new table is added later:** wiped automatically; a table that must survive a reset (none today) would need an explicit exclusion in the repository.

## 📝 Risks & Impact Review
The only irreversible effect is data loss, so the guards are the design: environment and loopback host checked on the server for every call, permission `MANAGE_RULES`, CSRF via `apiCall`, a confirm dialog, and no code path in production builds that renders the button. `BACKWARD_COMPATIBILITY.md` surfaces are untouched (a new route is additive; no schema, env or config change). Threat note for review: this route is the most destructive endpoint in the app, so `doc/security/threat-model.md` gets one line (a misconfigured `NODE_ENV=development` on a host with a local database would expose it to any `MANAGE_RULES` agent). Rollback is deleting the route and the button.

## 📋 Phasing
- **Phase 1:** repository, guard and service, route, permission table entry, tests (no UI).
- **Phase 2:** the header button and dialog, Storybook story, docs, QA scenario.

## 📋 Implementation Plan

### Phase 1 — Reset endpoint
1. `db`: add `DevDatabaseResetRepository.truncateAll()` and register it in `registerDb`; `test:db` test on a throwaway schema: rows in several tables disappear, `mikro_orm_migrations` stays, table list is read dynamically, second call is a no-op. App still works (nothing calls it).
2. `app/server`: add `isDevResetAvailable` (unit tests: development + `localhost`, `127.0.0.1`, `[::1]` true; production, `test`, remote host, unset URL treated as the default local host, garbage URL false) and `resetDevEnvironment` (fake ports: refuses when unavailable and touches nothing; wipes then seeds; seed failure surfaces). Register `devResetService` in the container.
3. Route `POST /api/dev/reset` with `authenticate`, `permission: "MANAGE_RULES"`, 404 when unavailable; add `"dev/reset/route.ts": ["MANAGE_RULES"]` to `ROUTE_PERMISSIONS`; route tests for 401, 403 for a plain agent, 404 outside development, 200 and reseed.

### Phase 2 — Button and docs
4. `ResetDevDbButton` client island and the dialog (Polish copy in `copy.ts`); `admin-shell.tsx` renders it first in the header when `isDevResetAvailable`; Storybook story for the closed, open, pending and failed states (`storybook:build` stays green).
5. Integration scenario `.ai/qa/RET/` style (agent-browser): create data, reset via the button, assert the login page, log in as the dev admin, assert only the seed data exists, assert the button is absent under a production build.
6. Docs: `README.md`, `GettingStarted.md` (when to use it, what it deletes), `Configuration.md` (availability rule, no new variable), one threat-model line, and a lesson if anything non-obvious turns up. Run the full gate.
