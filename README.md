# EasyRMS

**EasyRMS** (Easy Return Management System) is a web application for managing product returns.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- PostgreSQL with [MikroORM](https://mikro-orm.io) (migrations, connection pooling)
- [Awilix](https://github.com/jeffijoe/awilix) for dependency injection
- [Tailwind CSS](https://tailwindcss.com) for public (customer-facing) pages
- [shadcn/ui](https://ui.shadcn.com) for admin (back-office) pages

## Architecture

EasyRMS is a monorepo. Sub-packages live in `packages/`:

| Package | Responsibility |
|---|---|
| `packages/app` | The main application: Next.js routes, pages, API handlers, and the composition root where the DI container is wired up. |
| `packages/core` | Reusable, framework-agnostic business logic: domain models, services, shared types and utilities. |
| `packages/db` | Data management: MikroORM configuration, entities, migrations, repositories, seeders, and connection pool helpers. |
| `packages/ui` | Reusable UI components (shadcn/ui-based admin components, Tailwind-based public components). |

### Dependency rules

```
app  ->  ui, core, db
db   ->  core (shared types only)
ui   ->  (no internal packages)
core ->  (no internal packages)
```

- `core` has no dependency on React, Next.js, or the database.
- `ui` has no business logic or data access; components take data through props.
- All persistence goes through `db`; all schema changes are MikroORM migrations.
- Only `app` wires packages together and contains Next.js routes.

### Request flow

1. A request reaches a Next.js route or server component in `app`.
2. A per-request Awilix scope is created, including a forked MikroORM `EntityManager`.
3. The handler resolves services from the container; services in `core` use repositories from `db`.
4. Data is rendered with components from `ui`.

### Database

PostgreSQL is accessed through MikroORM with a single shared connection pool. Schema changes are versioned migrations in `packages/db`.

## Getting started

Requirements: Node.js 20.9+ and, for the local database, either PostgreSQL binaries (Linux, macOS or WSL) or Docker with the compose plugin (any OS, including native Windows).

```bash
npm run setup      # installs dependencies, starts local PostgreSQL, runs migrations
npm run dev        # starts @easyrms/app
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

`npm run setup` is idempotent: re-running it skips every step that is already done (dependencies up to date, database reachable, no pending migrations) and prints which ones were skipped. It starts only the default local database: with `scripts/db.sh` when PostgreSQL binaries are found, otherwise with `docker compose up -d --wait postgres` (`docker-compose.yml`, same credentials and port 5433); if you set `EASYRMS_DATABASE_URL` to another PostgreSQL, start that yourself and setup only runs the migrations.

### Manual setup

The same steps by hand, if you prefer or if `npm run setup` fails:

```bash
npm install
npm run db:start    # local PostgreSQL on localhost:5433 (needs PostgreSQL binaries; set PGBIN if not found)
# or: docker compose up -d --wait postgres
npm run db:migrate
npm run dev
```

Other commands:

```bash
npm run lint
npm run typecheck  # all workspaces
NODE_ENV=production npm run build
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `EASYRMS_DATABASE_URL` | `postgres://easyrms:easyrms@localhost:5433/easyrms` | PostgreSQL connection string |
| `EASYRMS_DB_POOL_MIN` / `EASYRMS_DB_POOL_MAX` | `2` / `10` | Connection pool size |
| `EASYRMS_DB_DEBUG` | `false` | Set to `true` to log SQL |

> **Status:** the monorepo, database (MikroORM), DI (Awilix) and UI (Tailwind, shadcn/ui) foundations are in place, with a first return-request flow. See `.ai/specs/implemented/`.

## For AI coding agents

Architectural decisions and conventions are recorded in [`AGENTS.md`](./AGENTS.md). Read it before making changes.
