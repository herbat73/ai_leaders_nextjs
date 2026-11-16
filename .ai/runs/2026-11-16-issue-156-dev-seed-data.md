# Issue #156 — test data for suppliers and administrators in the dev environment

Issue: https://github.com/herbat73/ai_leaders_nextjs/issues/156
Engine: om-auto-create-pr (steps: 6, --loop: no)
Claim-Run: 69294906-ccd5-4cc8-9b17-7af89b6202ed

## Goal

A fresh local checkout gets, without manual steps, two suppliers (`First Supplier` / `firstsupplier@example.com`,
`Another Supplier` / `anothersupplier@example.com`) and one initial administrator (`admin@example.com`, password
`123412341234`, `MANAGE_RULES`), created on the first start of the dev environment and never in production.

## Scope

- A dev-only, idempotent seeder: `npm run seed:dev` (script in `packages/app/scripts/seed-dev.ts`), logic in
  `packages/app/src/server/dev-seed.ts` so it is unit-testable with fake services.
- Wired into `npm run setup` (new step after migrations) so a fresh checkout is seeded on first setup.
- Documented in `Configuration.md` / `README.md` / `GettingStarted.md`.

## Decisions (defaults for the open points, flagged on the PR for override)

- **"On first load" = first `npm run setup`** (the documented bootstrap of a fresh checkout) plus an explicit
  `npm run seed:dev` for an existing checkout. Seeding from a Next.js startup hook was rejected: it would run on every
  dev-server start in every environment variable combination, needs the `server-only` container, and hides a
  known-password account behind an implicit side effect.
- **Dev only, fail closed:** the seeder refuses when `NODE_ENV=production`, and `setup` only seeds the default local
  database (`managesLocalDatabase`), never a database set through `EASYRMS_DATABASE_URL`. The known password lives
  only in the seed constants, never in `Configuration.md` defaults or env.
- **Idempotent:** existing suppliers (by name) and an existing agent (any status, by e-mail) are left untouched — a
  rerun never resets a password or reactivates anything. The admin goes through the real `AgentService.invite` +
  `acceptInvite` path so the password is hashed by the production hasher (no raw SQL, no entity internals).
- Persistence stays in `db` (reused services/repositories); no new migration, entity or route.

## Non-goals

- No seeding of returns/complaints (the QA scripts own that), no production seeding, no new login UI, no change of
  the password policy (12 characters minimum; the issue's password has exactly 12).

## Implementation Plan

### Phase 1: Seeder
1. Seed constants and `seedDevData` in `packages/app/src/server/dev-seed.ts` (idempotent, production guard).
2. Unit tests with fake services: creates both suppliers + admin; second run changes nothing; existing agent or
   supplier untouched; refuses in production.

### Phase 2: Wiring
3. `packages/app/scripts/seed-dev.ts` (container like `agent-create.ts`) and `seed:dev` npm scripts (app + root).
4. `scripts/setup.mjs`: seed step after migrations, local default database only.

### Phase 3: Docs and gate
5. Document in `Configuration.md`, `README.md`, `GettingStarted.md`; lessons entry if anything non-obvious.
6. Full validation gate, run the seeder against the dev database and log in as the seeded admin.

## Risks

- A known-password admin must never reach a shared or production database: guarded twice (script refuses on
  `NODE_ENV=production`, setup seeds only the default local DB) and documented as dev-only.
- Re-seeding must not overwrite a password changed by a developer: existing e-mails are skipped.
- `npm run test:db` is outside the gate; the seeder is covered by unit tests with fakes and verified live in step 6.

## Progress

PR: #157

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Seeder

- [x] 1.1 Seed constants and idempotent `seedDevData` — 825547d
- [x] 1.2 Unit tests for the seeder — 825547d

### Phase 2: Wiring

- [x] 2.1 `seed-dev.ts` script and `seed:dev` npm scripts — 6eaedea
- [x] 2.2 Seed step in `npm run setup` — 6eaedea

### Phase 3: Docs and gate

- [x] 3.1 Documentation — 7100190
- [x] 3.2 Full gate and live verification — 7100190

## Outcome

- Gate: typecheck, `npm test` (core, db, ui, app incl. 8 new seeder tests), lint (0 errors; 90 pre-existing warnings, none in the new files), audit, docs:check, storybook:build, `NODE_ENV=production npm run build` — all green.
- Live check on a throwaway database (`easyrms_seed_check`, dropped afterwards; not the developer's `easyrms` database): first run created 2 suppliers + the admin (`active`, `MANAGE_RULES`, `scrypt$` hash, invite cleared); second run changed nothing; `NODE_ENV=production` refused; `POST /api/agents/login` with `admin@example.com` / `123412341234` answered 200, a wrong password 401.
- Not run: `npm run test:db` (outside the gate; no db package change). `npm run setup` end to end on a fresh checkout was not run: the setup step is a three-line guard around `npm run seed:dev`.
