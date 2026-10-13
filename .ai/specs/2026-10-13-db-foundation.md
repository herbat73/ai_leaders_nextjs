# Database foundation (MikroORM + PostgreSQL)

- **Date:** 2026-10-13
- **Status:** Implemented in the same change (move to `implemented/` once all three phases ship)
- **Part of:** `2026-10-13-monorepo-migration.md`, phase 2

## Goal

`@easyrms/db` owns persistence: MikroORM 7 on PostgreSQL with a shared connection pool, versioned migrations, and a first entity (`ReturnRequest`) so the stack is exercised end to end.

## Design

- Entities are defined with `defineEntity` (pure style) in `packages/db/src/entities`.
- Config in `packages/db/src/config.ts`: `DATABASE_URL` (default `postgres://easyrms:easyrms@localhost:5433/easyrms`), pool `min 2 / max 10` (override via `DATABASE_POOL_MIN/MAX`), migrations in `packages/db/src/migrations`.
- `getOrm()` returns one `MikroORM` instance cached on `globalThis` (survives Next.js dev reloads); one pool per process.
- Migrations are run by the CLI (`npm run db:migrate`, `db:migration:create`), never from request handling.
- `packages/db/src/repositories` implements the repository ports declared in `@easyrms/core` (`db` depends on `core`, never the reverse).
- Local database: `npm run db:start` initialises and starts a PostgreSQL cluster in `.data/postgres` (git-ignored) on port 5433 using the system PostgreSQL binaries; `db:stop` stops it. Any PostgreSQL works if `DATABASE_URL` is set.

## Out of scope

Auth, seeding beyond a dev seed, multi-tenancy.
