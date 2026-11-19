# Capability: dev-environment-reset

Lets a developer on a local development environment return the database to its seeded state from the admin header.

## Requirement: Reset button only in a development environment
The system SHALL show the "Resetuj bazę" button in the admin header only when `NODE_ENV` is `development` and the configured database host is a loopback address, and SHALL answer `POST /api/dev/reset` with 404 in every other case.

### Scenario: Production or remote database
- WHEN the process runs with `NODE_ENV=production`, or `EASYRMS_DATABASE_URL` points at a non-loopback host
- THEN the admin header has no reset button and `POST /api/dev/reset` returns 404 without touching the database

### Scenario: Local development
- WHEN a signed-in agent with `MANAGE_RULES` opens any admin page under `next dev` against the default local database
- THEN the button is the first item at the left of the header

Source: .ai/specs/2026-11-19-dev-db-reset.md

## Requirement: Reset needs confirmation and permission
The system SHALL run the reset only after the agent confirms "Czy chcesz zresetować bazę do pierwotnego stanu developerskiego?" and only for an agent with `MANAGE_RULES`.

### Scenario: Cancel
- WHEN the agent clicks the button and then "Anuluj"
- THEN no request is sent and the data is unchanged

### Scenario: Agent without permission
- WHEN an agent without `MANAGE_RULES` (or no agent, or a request without the CSRF header) calls `POST /api/dev/reset`
- THEN the answer is 403 (401 without a session, 403 `csrf_rejected` for CSRF) and the data is unchanged

Source: .ai/specs/2026-11-19-dev-db-reset.md

## Requirement: Reset restores the seeded dev state
The system SHALL, on a confirmed reset, delete all rows of every application table and then seed the dev suppliers and the dev admin exactly as `npm run seed:dev` does, and SHALL send the agent to the login page.

### Scenario: Reset after use
- WHEN returns, claims, evidence and an extra agent exist and the agent confirms the reset
- THEN only the two dev suppliers and `admin@example.com` remain, the old session no longer opens the back office (identities are not restarted, so the new admin has a new id), and logging in with the dev admin password works

### Scenario: Seed fails after the wipe
- WHEN the truncate succeeds and the seed throws
- THEN the answer is 500 with a message to run `npm run seed:dev`, and the failure is logged with no secret in it

Source: .ai/specs/2026-11-19-dev-db-reset.md
