# Idempotent `npm run setup` installer

## 📝 TLDR
A developer cloning EasyRMS today runs four separate commands from the README (`npm install`, `npm run db:start`, `npm run db:migrate`, `npm run dev`) and gets a runtime error if one is missed. This spec proposes a single zero-dependency Node script, `npm run setup`, that performs the install, database and migration steps, skips whatever is already done, and can be re-run safely. The manual steps stay in the README as the alternative. (Implemented; tracked by issue #3. Status as of 2026-10-23: shipped in `scripts/setup.mjs` and the root `setup` script; the Docker Compose fallback is described in the 2026-10-18 amendment.)

## 📝 Problem Statement
Who: a developer setting up EasyRMS locally for the first time (or after a long break).

Today the setup path is split across the README "Getting started" block and a "Status" note below it. The first block (`npm install`, `npm run dev`, …) omits `db:start` and `db:migrate`, which the Status note mentions, so following the first block alone starts an app with no database. The Status note also documents `DATABASE_URL` / `DATABASE_POOL_MIN` / `DATABASE_POOL_MAX`, but `packages/db/src/config.ts` reads `EASYRMS_DATABASE_URL` / `EASYRMS_DB_POOL_MIN` / `EASYRMS_DB_POOL_MAX` (observed in code).

Success looks like: on a clean clone, `npm run setup` ends with a migrated database and a hint to run `npm run dev`; a second run exits 0 and reports every step as skipped.

## 📝 Proposed Solution
Add `scripts/setup.mjs` (Node ESM, no dependencies, same style as `scripts/audit.mjs`) and a root script `"setup": "node scripts/setup.mjs"`. The script runs a fixed list of steps. Each step has a `check()` ("already done?") and a `run()`; a step whose check passes is reported as skipped. Output is a per-step `done` / `skipped` summary followed by the next command.

Alternatives considered:
- **Extend `scripts/db.sh`** — rejected: it is bash-only, scoped to Postgres, and has no concept of install or migrate steps.
- **Docker Compose** — originally rejected (new tool choice needing approval). **Amended 2026-10-18 (approved by the user):** `docker-compose.yml` is the fallback for step 3 when no PostgreSQL binaries are found (e.g. native Windows); it uses the same default URL (`easyrms` user/db, host port 5433). Native binaries via `scripts/db.sh` are still preferred.
- **`npm run setup` chaining existing scripts with `&&`** — rejected: it cannot skip completed steps or give actionable errors.

Non-goals: starting the dev server; installing Node or PostgreSQL; seeding data; production/CI provisioning; any change to `scripts/db.sh`, MikroORM config, migrations or app code.

## 📝 Architecture
Tooling only; no package in `packages/*` changes, so the dependency direction in AGENTS.md is untouched. The script reuses the existing entry points rather than duplicating them: `npm install`, `npm run db:start` (→ `scripts/db.sh start`, already idempotent: it reuses `.data/postgres` and creates the role and database only when missing) and `npm run db:migrate` (MikroORM `migration:up`, a no-op when nothing is pending). The one piece of knowledge it must share with `packages/db/src/config.ts` is the default URL `postgres://easyrms:easyrms@localhost:5433/easyrms`; the script restates it as a constant with a comment pointing at `DEFAULT_DATABASE_URL` (importing the TypeScript config from a plain `.mjs` script is out of scope).

Step order and checks:

| # | Step | Skipped when | Otherwise |
|---|---|---|---|
| 1 | Preflight | — (always runs) | Fail fast on unsupported Node. |
| 2 | Install dependencies | `node_modules/.package-lock.json` exists and is not older than `package-lock.json` | `npm install` |
| 3 | Database up | TCP connect to the host/port of the effective database URL succeeds | Local default URL: `npm run db:start`. Non-default URL: fail with a message (the script does not manage external databases). |
| 4 | Migrate | `npm run db:migration:pending -w @easyrms/db` reports none pending | `npm run db:migrate` |

The effective URL is `EASYRMS_DATABASE_URL` when set, else the default. Step 3's local-start path additionally verifies PostgreSQL binaries exist, resolved the same way `scripts/db.sh` does (`/usr/lib/postgresql/*/bin`, or `pg_ctl` on `PATH`), and fails with install guidance when they do not.

## 📝 API Contracts
Command surface only:

- `npm run setup` — exit `0` when every step is done or skipped; non-zero with a one-line actionable message on the first failing step. No flags in this version.
- Reads `EASYRMS_DATABASE_URL` (existing variable, already honored by `packages/db`). Introduces no new environment variables.
- Child commands run from the repo root with inherited stdio so the user sees npm/MikroORM output.

## 📝 UI/UX
Terminal output only. One line per step in the form `✔ install dependencies — done` / `↷ start database — skipped (already reachable on localhost:5433)`, then `Next: npm run dev → http://localhost:3000`. Errors name the step, the cause and the manual command to try (for example `npm run db:start`).

README changes (same PR as the implementation): "Getting started" leads with `npm run setup` and a note that it is safe to re-run; the existing manual commands move under a "Manual setup" subsection as the alternative; the Status note is corrected to the real variable names (`EASYRMS_DATABASE_URL`, `EASYRMS_DB_POOL_MIN`, `EASYRMS_DB_POOL_MAX`).

## 📝 Edge Cases & Failure Scenarios
- **Postgres already running** (started by an earlier run or by the user): step 3 skips; step 4 still runs.
- **Postgres stopped after a prior setup**: step 3 restarts it via `db:start`.
- **Port 5433 taken by something else**: the TCP check passes but migrations fail; step 4 reports the failing command's output. Accepted limitation; a protocol-level check is out of scope.
- **`npm install` interrupted**: `node_modules/.package-lock.json` is written at the end of a successful install, so a partial install is re-run next time.
- **`package-lock.json` changed after a `git pull`**: the lockfile is newer than the marker, so step 2 re-runs.
- **Missing PostgreSQL binaries**: preflight message names the missing binary and the `PGBIN` override that `scripts/db.sh` already honors.
- **Windows**: `scripts/db.sh` requires bash; on native Windows step 3 uses the Docker Compose fallback. Child commands run through the shell because `npm` is `npm.cmd` there, which `spawnSync` cannot start directly.
- **Concurrent runs**: not guarded; two simultaneous runs are unsupported.

## 📝 Risks & Impact Review
Low. The change adds one npm script and edits docs; nothing in `BACKWARD_COMPATIBILITY.md`-protected surfaces (APIs, schema, config formats) changes, and no existing script changes behavior. The script runs migrations, but only through the existing `db:migrate` command against the user's own local or explicitly configured database. The restated default-URL constant can drift from `packages/db/src/config.ts`; the comment pointing at it and the manual verification in the plan are the mitigation.

## Resolved assumptions (autonomous defaults)

| # | Question | Chosen default | Rationale |
|---|---|---|---|
| Q1 | Should `setup` also run `lint` / `typecheck`? | No. | It is a setup step, not the validation gate; avoids slow, unrelated failures. Reversible: add a step later. |
| Q2 | If `EASYRMS_DATABASE_URL` points at a non-default database, skip `db:start` and only migrate? | Yes; never start or modify a database the script does not own. | Smallest blast radius; an unreachable external DB is a clear error rather than a surprise local server. |
| Q3 | Support Windows natively? | No (documented: Linux/macOS/WSL). | `scripts/db.sh` is bash; changing it is a non-goal. |
| Q4 | Create a `.env` file? | No. | The app reads environment variables directly; defaults already work locally; avoids writing config. |
| Q5 | Add flags (`--skip-install`, `--yes`)? | No. | Idempotent skips make them unnecessary; YAGNI. |

## 📋 Phasing
Single phase; one PR delivers the script and the README update. Nothing here is independently deployable beyond that.

## 📋 Implementation Plan

### Phase 1 — Installer script and README

1. **Scaffold the script.** Add `scripts/setup.mjs` with a step runner (`check`/`run`, per-step `done`/`skipped` output, fail-fast with actionable messages, exit codes) and the root `package.json` `setup` script. Steps are stubs that print their name. *Test:* `npm run setup` exits 0 and prints all four steps; `npm run lint` passes on the new file.
2. **Preflight and install steps.** Implement the Node-version check (minimum taken from `node_modules/next/package.json` `engines`) and the lockfile-vs-`node_modules/.package-lock.json` freshness check, running `npm install` when stale. *Test:* with `node_modules` present the step is skipped; after `touch package-lock.json` it runs; with `node_modules` removed it runs.
3. **Database step.** Implement effective-URL resolution, the TCP reachability check, the PostgreSQL-binary check and the `npm run db:start` call, plus the non-default-URL failure path. *Test:* stop Postgres (`npm run db:stop`) and confirm restart; with it running confirm skip; with `EASYRMS_DATABASE_URL` pointing at an unreachable host confirm a clear failure and that `db:start` is not invoked.
4. **Migration step.** Implement the pending check via `db:migration:pending` (verify its output/exit semantics against the installed MikroORM CLI before relying on it; fall back to always running `db:migrate`, which is itself idempotent, reporting `done`) and the `npm run db:migrate` call. *Test:* fresh DB applies migrations; second run reports skipped (or a no-op migrate).
5. **README.** Update "Getting started" (setup first, idempotency note, "Manual setup" alternative, platform note) and correct the environment variable names in the Status note to match `packages/db/src/config.ts`. *Test:* every command in the README exists in `package.json`; variable names match the code (`grep` the config).
6. **End-to-end verification and gate.** On a clean checkout (no `node_modules`, no `.data/`) run `npm run setup` twice and record that the second run skips every step. Run the full gate: `npm run typecheck`, `npm run lint`, `npm run audit`, `NODE_ENV=production npm run build`. The repo has no test runner, so manual verification is the baseline; pure helpers (URL parsing, freshness comparison) are exported-free functions kept small enough to review by reading.
