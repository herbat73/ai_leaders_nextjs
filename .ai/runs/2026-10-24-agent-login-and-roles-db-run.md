# test:db run — agent login and roles (PR #33)

Date: 2026-10-24. Local PostgreSQL 17 on :5433 (`npm run db:start`), throwaway schema per test file.

`npm run test:db`: 6 test files, 75 tests passed. New in this PR:
- `agent-login-migration.test.ts`: `agents` defaults, unique e-mail, unique invite token hash (many nulls allowed), restrict on deleting an agent that decided, `down` drops everything when no event carries an agent and refuses (changing nothing) when one does.
- `agents/agent.repository.test.ts`: e-mail normalisation, no credentials on record types, concurrent first invites answer `ConflictError` for all but one, single-use invite under 8 racing accepts, expired/used/unknown tokens, expiry instant counts as expired, re-invite replaces token/password/permissions and bumps the epoch, disable bumps the epoch, last manager refused, two managers racing to disable each other: exactly one wins.
- `returns/return.repository.test.ts`: the deciding agent stored on the event and shown by `findDetail` only (never by `findByRma`), a missing agent rolls the move back, `findRequest` returns resolution and amount without the note.
- The customer-portal migration tests now migrate to `Migration20261023202921` (their `down` tests assumed it was the newest migration).

Manual runs against the dev server and the same database are in `.ai/runs/2026-10-24-agent-login-and-roles/checkpoint-{1,2,3}-checks.md` and `final-gate-checks.md`.
