<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EasyRMS — project overview and architectural assumptions

**EasyRMS** (Easy Return Management System) is a web application for managing product returns. The assumptions below are decisions already made — follow them, and do not swap in alternatives without the user's explicit approval. If a task seems to conflict with them, stop and ask.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Latest Next.js (App Router) + React + TypeScript (strict mode) |
| Database | PostgreSQL |
| ORM / data layer | MikroORM — migrations, connection pooling, entity-manager-per-request |
| Dependency injection | [Awilix](https://github.com/jeffijoe/awilix) container |
| Public/customer-facing pages (frontend) | Tailwind CSS |
| Admin/back-office pages (backend) | shadcn/ui (built on Tailwind) |

Notes:

- The DI container is **Awilix**. Use the `awilix` npm package.
- Next.js here has breaking changes versus common knowledge — see the Next.js block at the top of this file and read `node_modules/next/dist/docs/` before writing Next.js code.
- "Frontend pages" means customer-facing pages (e.g. starting and tracking a return); "backend pages" means the admin/back-office UI (e.g. processing returns). Frontend pages use plain Tailwind; backend pages use shadcn/ui components.

## Monorepo layout

The repo is a monorepo. Sub-packages live in `packages/`. This is the **minimum** structure; add packages when needed, but do not collapse or rename these.

```
packages/
  app/    # main application — Next.js app, routes, pages, API handlers, composition root
  core/   # reusable, framework-agnostic business logic (domain models, services, DI registrations, shared types/utils)
  db/     # data management — MikroORM config, entities, migrations, repositories, seeders, connection/pool helpers
  ui/     # reusable UI components (shadcn/ui-based admin components, Tailwind-based public components)
```

Dependency direction (no cycles, enforce it in reviews):

```
app  →  ui, core, db
ui   →  (nothing internal; no db, no app)
db   →  core (for shared types only, if needed)
core →  (nothing internal)
```

- `core` must not import from `db`, `ui`, `app`, React, or Next.js.
- `ui` must not contain business logic or data access; components receive data via props.
- `db` owns all persistence. Nothing outside `db` imports MikroORM entities' internals directly or writes raw SQL; go through repositories/services registered in the container.
- `app` is the only place that wires everything together (the Awilix composition root) and the only package that contains Next.js routes.
- Packages are referenced by workspace name (e.g. `@easyrms/core`), never by relative paths across package boundaries.

## Conventions

- **TypeScript:** strict mode, no `any` without a justifying comment, prefer explicit return types on exported functions.
- **Dependency injection:** register services in Awilix and resolve them from the container (per-request scope for request-bound state such as the MikroORM `EntityManager` fork). Do not instantiate services with `new` inside route handlers or components, and do not import a global container into `core`.
- **Database:** all schema changes go through MikroORM migrations in `packages/db` (never edit the schema by hand or rely on `schema:update` outside local experiments). Use a single shared connection pool configured in `db`; never create ad-hoc connections. Fork the `EntityManager` per request.
- **UI:** use shadcn/ui components for admin pages and Tailwind utility classes for public pages; share reusable components via `packages/ui`. Do not add another component library or CSS framework.
- **Next.js:** prefer Server Components; add `"use client"` only when needed. Keep route handlers thin — delegate to services resolved from the container.
- **Config and secrets:** read configuration from environment variables (document new ones in the README); never commit secrets.

## Current state

The monorepo structure is in place (npm workspaces, `packages/{app,core,db,ui}`, shared `tsconfig.base.json`). The Next.js app lives in `packages/app`. MikroORM (`db`), Awilix (composition root in `packages/app/src/server/container.ts`), Tailwind and shadcn/ui (`ui`) are installed and wired; the first feature is return requests (public form at `/`, admin list at `/admin/returns`, API under `/api`). Local database: `npm run db:start`, then `npm run db:migrate` (see `.ai/specs/implemented/`).

Practical notes:

- Run commands from the repo root: `npm run dev | build | lint | typecheck`. Root scripts delegate to `@easyrms/app`.
- Internal packages ship TypeScript source (no build step); `packages/app/next.config.ts` lists them in `transpilePackages`. Add any new internal package there.
- Add a dependency to the workspace that uses it (`npm install <pkg> -w @easyrms/<name>`), not the root.
- If the shell sets `NODE_ENV=development`, `next build` fails prerendering `/_global-error`; run it as `NODE_ENV=production npm run build`.

# Project memory and spec-driven development (SDD)

This repo uses a `.ai/` folder as persistent, file-based memory and spec tracking for AI agents. Everything below is mandatory process, not optional bookkeeping — follow it on every task unless the user explicitly says otherwise.

## `.ai/specs/` — specifications

Specs describe a feature or change before it's built (spec-driven development). Every spec is a single markdown file named:

```
YYYY-MM-DD-slug.md
```

- `YYYY-MM-DD` is the date the spec was written (use the actual current date, not an estimate).
- `slug` is a short kebab-case description, e.g. `2026-10-13-user-avatar-upload.md`.

Lifecycle:

- **New specs** go directly in `.ai/specs/`.
- Once a spec has been fully implemented, move it to `.ai/specs/implemented/` (keep the same filename). This keeps `.ai/specs/` showing only what's pending or in progress.
- If a spec is abandoned, superseded, or otherwise no longer relevant, move it to `.ai/specs/archive/` instead of deleting it.

Before starting work on a feature, check `.ai/specs/` for an existing spec covering it. For any non-trivial feature or change, write a spec there first and get it reviewed/approved before implementing, rather than jumping straight to code.

## `.ai/runs/` — autonomous run logs

Every autonomous AI run (unattended multi-step work, scheduled/looped runs, long background agent tasks) must write a log file to `.ai/runs/` named:

```
YYYY-MM-DD-slug.md
```

Same naming convention as specs: current date + short kebab-case slug describing the run. The log should capture what was attempted, what changed, and the outcome, so a human or another agent can reconstruct what happened without replaying the whole session.

## `.ai/lessons.md` and `.ai/lessons/` — long-term lessons learned

`.ai/lessons.md` is the running index of lessons learned by AI agents working in this repo: bug root causes, gotchas, footguns, things that cost time to figure out, or approaches that turned out to be wrong.

- **Read `.ai/lessons.md` before starting non-trivial work** so you don't repeat a past mistake.
- **After fixing a bug, or whenever you learn something non-obvious worth keeping long-term, append an entry to `.ai/lessons.md`.** Keep entries short; newest at the top.
- If a lesson needs more depth (code samples, multi-part explanation), write it as its own file under `.ai/lessons/YYYY-MM-DD-slug.md` and link it from the index entry instead of inlining everything into `.ai/lessons.md`.

## Keep AGENTS.md up to date (correction feedback loop)

Treat this file as a living document that you improve whenever you get corrected (practice from Boris Cherny's Claude Code tips).

- After the user corrects you or points out a mistake, update this file (or add an entry to `.ai/lessons.md` for narrower, one-off gotchas) with a rule that prevents the same mistake from happening again. If the user says "update your AGENTS.md so you don't make that mistake again", do exactly that.
- Write the rule yourself, concisely and specifically (what to do or avoid, and why). Prefer a short, actionable rule over a long explanation.
- Edit or merge existing rules instead of piling up near-duplicates, and remove rules that turn out to be wrong or obsolete.
- Keep iterating: the goal is for the mistake rate to measurably drop over time.

## Summary

| Path | Purpose | Naming |
|---|---|---|
| `.ai/specs/` | Pending/active specs | `YYYY-MM-DD-slug.md` |
| `.ai/specs/implemented/` | Completed specs | `YYYY-MM-DD-slug.md` |
| `.ai/specs/archive/` | Abandoned/superseded specs | `YYYY-MM-DD-slug.md` |
| `.ai/runs/` | Autonomous run logs | `YYYY-MM-DD-slug.md` |
| `.ai/lessons.md` | Index of lessons learned | — |
| `.ai/lessons/` | Deep-dive lesson writeups | `YYYY-MM-DD-slug.md` |
