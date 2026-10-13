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

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Status:** the repo currently holds the bootstrapped single-package Next.js app at the root. Moving it into the `packages/` layout described above is pending.

## For AI coding agents

Architectural decisions and conventions are recorded in [`AGENTS.md`](./AGENTS.md). Read it before making changes.
