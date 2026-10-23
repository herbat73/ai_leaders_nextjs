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

### Returns workflow

A return request moves through a fixed path, enforced by a state machine in `@easyrms/core`: `submitted` → `approved` → `in_transit` → `received` → `resolved`, or `submitted` → `rejected` (a rejection needs a reason of at least 30 characters). Other statuses (`awaiting_customer`, `in_service`, `cancelled`) exist for later work and have no moves yet. Every request gets an RMA number (`RMA-YYYY-NNNNN`, from a Postgres sequence, year in `Europe/Warsaw`) and a timeline of events. `/admin/returns` is the inbox (status filter, due marker for requests still `submitted` after two business days) and `/admin/returns/[id]` is the decision card.

> **Do not expose the app publicly yet.** Agents are anonymous: `/admin` and `PATCH /api/returns/[id]` have no authentication, so anyone who can reach them can approve or reject returns. An agent login spec is a recorded blocker (product brief, Q15).

### Database

PostgreSQL is accessed through MikroORM with a single shared connection pool. Schema changes are versioned migrations in `packages/db`.

## Getting started

Requirements: Node.js 20.19+ (Next.js needs 20.9+, but the test runner's Vite needs 20.19+) and, for the local database, either PostgreSQL binaries (Linux, macOS or WSL) or Docker with the compose plugin (any OS, including native Windows).

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
npm test           # unit tests (Vitest, @easyrms/core)
npm run test:db    # database tests (Vitest, @easyrms/db): migration and repository against the local Postgres
npm run storybook  # component catalog on http://localhost:6006
npm run storybook:build  # static Storybook in packages/app/storybook-static (part of the validation gate)
NODE_ENV=production npm run build
```

### Database tests

`npm run test:db` runs Vitest in `@easyrms/db` against the local PostgreSQL from `npm run db:start` (or the database in `EASYRMS_DATABASE_URL`). Every test file creates a throwaway schema (selected through `search_path`) and drops it afterwards, so your data is untouched. It covers the migration (status mapping, RMA backfill order, `down` refusal) and the repository (compare-and-set transitions, events). It is not part of `npm test` or the CI gate until CI has a Postgres service, so record its result in `.ai/runs/` for each PR that touches `packages/db`.

### Storybook

Storybook 10 (`@storybook/nextjs-vite`) is configured in `packages/app/.storybook/` and renders components with the
app's real Tailwind + shadcn theme (`globals.css`). All stories live in `packages/ui/src/storybook/`, mirroring the
component path (`storybook/admin/button.stories.tsx` covers `admin/button.tsx`). They import types from
`@storybook/react` so `ui` stays free of Next.js. A component that lives only in `app` gets a story once it moves to `ui`. Use the toolbar to switch light/dark and the Accessibility
panel to check WCAG issues. Stories pass props only: no database, container or `server-only` imports.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `EASYRMS_DATABASE_URL` | `postgres://easyrms:easyrms@localhost:5433/easyrms` | PostgreSQL connection string |
| `EASYRMS_DB_POOL_MIN` / `EASYRMS_DB_POOL_MAX` | `2` / `10` | Connection pool size |
| `EASYRMS_DB_DEBUG` | `false` | Set to `true` to log SQL |

> **Status:** the monorepo, database (MikroORM), DI (Awilix) and UI (Tailwind, shadcn/ui) foundations are in place, with a first return-request flow. See `.ai/specs/implemented/`.

## For AI coding agents

Architectural decisions and conventions are recorded in [`AGENTS.md`](./AGENTS.md). Read it before making changes.
