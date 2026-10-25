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
| Validation | [Zod](https://zod.dev) schemas in `core`, shared by API routes and forms |
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

### Domain concept convention

Domain code is not organized into `modules/`. Each concept (today: `returns`) is a same-named sub-folder repeated
across the layers that need it:

- `packages/db/src/entities/<concept>/<name>.entity.ts` and `packages/db/src/repositories/<concept>/<name>.repository.ts`
- `packages/core/src/services/<concept>/<name>.service.ts` and `packages/core/src/validators/<concept>/` (shared Zod schemas)
- `packages/app/src/app/api/<concept>/route.ts` and the matching pages

Create a concept folder only when its first file is added; never scaffold empty ones. There is no per-concept
setup/ACL/auto-discovery. Register every service explicitly in Awilix (no `loadModules`). See
`doc/engineering-standards.md` for the naming table, security minimums and the "adding a concept" checklist;
review against `doc/code-review-checklist.md`.

### Reusable API & UI layer

Every route and page reuses two shared layers instead of re-implementing fetch/validation/error handling:

- `packages/core/src/http/` — `apiHandler` (maps `AppError`s to status + `{ ok, data } | { ok: false, error }`
  envelope, logs unexpected failures) and `makeCrudRoute` (schemas + service in, configured handlers out). Routes
  contain no `try/catch`.
- `packages/ui/src/admin/` — `api/api-call.ts` (the only sanctioned `fetch('/api/*')` site), `forms/crud-form.tsx`,
  `tables/data-table.tsx`, `feedback/*`.

Before building a new cross-cutting primitive (rules engine, money, state machine, ports, limiter, import, stat/rule components, …), check `doc/platform-primitives.md`: it maps which primitives exist, which spec builds them and which are non-binding design sketches. Reuse a built one; start from a sketch rather than a parallel mechanism; update its row when a spec lands.

### Design system (Storybook is the manual)

Before building or changing any screen, read `packages/ui/src/storybook/agent/dla-agenta-ai.mdx` (component picker, allowed
tokens, forbidden list) and copy a skeleton from `storybook/patterns/ekrany.stories.tsx`. Every `ui` component has a docs
page `storybook/<component path>.mdx` (Polish; sections Kiedy użyć, Kiedy nie użyć, Jak złożyć, Tokeny, Stany, Dostępność,
Rób i nie rób, API) next to its stories: read it before using the component. Colours come only from the semantic tokens in
`packages/ui/src/styles.css` (never palette classes, hex, `text-white`, or `dark:` for token colours); a new token or
component updates the docs page in the same change. `npm run docs:check` (in the validation gate) fails on a component
without story/page/sections and on raw palette colours.

Data flow is hybrid: Server Components for reads; mutations and client-initiated reads go through `apiCall` to API
routes. Do not add Server Actions. New reusable components: shadcn primitive → `ui/src/admin/` (via
`npx shadcn@latest add`); generic pattern → `ui/src/admin/<category>/`; concept-specific →
`ui/src/{admin,public}/<concept>/`; used by one page → colocate until a second page needs it.

## Conventions

- **TypeScript:** strict mode, no `any` without a justifying comment, prefer explicit return types on exported functions.
- **Dependency injection:** register services in Awilix and resolve them from the container (per-request scope for request-bound state such as the MikroORM `EntityManager` fork). Do not instantiate services with `new` inside route handlers or components, and do not import a global container into `core`.
- **Database:** all schema changes go through MikroORM migrations in `packages/db` (never edit the schema by hand or rely on `schema:update` outside local experiments). Use a single shared connection pool configured in `db`; never create ad-hoc connections. Fork the `EntityManager` per request.
- **UI:** use shadcn/ui components for admin pages and Tailwind utility classes for public pages; share reusable components via `packages/ui`. Do not add another component library or CSS framework.
- **Next.js:** prefer Server Components; add `"use client"` only when needed. Keep route handlers thin — delegate to services resolved from the container.
- **Config and secrets:** read configuration from environment variables (document new ones in the README); never commit secrets.

## Current state

The monorepo structure is in place (npm workspaces, `packages/{app,core,db,ui}`, shared `tsconfig.base.json`). The Next.js app lives in `packages/app`. MikroORM (`db`), Awilix (composition root in `packages/app/src/server/container.ts`), Tailwind and shadcn/ui (`ui`) are installed and wired; the first feature is return requests (customer portal: order lookup at `/`, overview `/returns`, wizard `/returns/new`, tracker `/returns/[rma]`, backed by an order-scoped guest session cookie, the `OrderLookup` and `MailPort` ports with fake/log adapters, a return items table, a CSRF check in the shared HTTP layer and `POST /api/returns` (the old `submit` route and legacy form no longer exist); agent inbox at `/admin/returns` and decision card at `/admin/returns/[id]` with a nine-status state machine, RMA numbers and a timeline naming the deciding agent, API under `/api`; agent login (`/admin/login`, invite acceptance at `/admin/invite/[token]`, `agents` table, signed `easyrms_agent` cookie, `proxy.ts` plus `requireAgentPage`/`requireAgent` in `app/src/server/agent-auth.ts`, first agent via `npm run agent:create`, agent management at `/admin/agents`, refunds above `EASYRMS_REFUND_APPROVAL_LIMIT` need `MANAGE_RULES`, read-only customer-view preview at `/admin/returns/[id]/customer-view` sharing `returns/_components/tracker-body.tsx` with the customer tracker); plus the case sample lab at `/admin/discovery/case-sample`, a stateless discovery tool built on the rules engine, `Money`, metrics and tabular import in `core`). Complaints (`kind = 'complaint'`, spec `2026-10-25-complaints-and-vendor-claim`) share the same requests, inbox, decision card and tracker: wizard at `/returns/complaint/new`, a 24-month window, defect fields, repair/replacement/refund, a 14-day deadline with escalation from day 10, and the agent's defect finding with the move to `received`; a confirmed defect can be claimed from a vendor (`suppliers` at `/admin/suppliers`, one claim per complaint at `/admin/supplier-claims`, sent by e-mail through `MailPort`; `EASYRMS_MAIL_TRANSPORT=smtp` is the only transport that delivers, with `log` a claim stays a draft). Customer flows need a real order adapter and fail closed in production (see README). Local database: `npm run db:start`, then `npm run db:migrate` (see `.ai/specs/implemented/`).

Practical notes:

- Run commands from the repo root: `npm run dev | build | lint | typecheck | test | test:db | audit | docs:check | storybook | storybook:build`. Storybook (config in `packages/app/.storybook/`) catalogs components; every reusable `ui` component ships a `*.stories.tsx` covering its states, and all stories live in `packages/ui/src/storybook/` mirroring the component path (e.g. `storybook/admin/button.stories.tsx` for `admin/button.tsx`), never next to the component. `storybook:build` is in the validation gate. `ui` stories import from `@storybook/react` (never `@storybook/nextjs-vite`) to keep `ui` Next-free. `test` runs Vitest in `@easyrms/core` (pure unit tests in `src/**/*.test.ts`, no database or React). `test:db` runs Vitest in `@easyrms/db` against the local Postgres (`npm run db:start`) on a throwaway schema per test file (it includes the portal migration and concurrency tests); the `@easyrms/db` script is also named `test:db` (never `test`), so root `npm test` and the gate do not pull it in until CI has a Postgres service; record its result in `.ai/runs/` per PR. `app` and `ui` have no runner yet. `lint` (root `eslint.config.mjs`) covers all packages and enforces the dependency direction; `audit` (`scripts/audit.mjs`) fails on high+ advisories except those in `audit-allowlist.json` (each with a reason and expiry) and is part of the validation gate.
- Every admin page must call `requireAgentPage(path)` and render inside `AdminShell`; every agent-only API route passes `authenticate: requireAgent` to `apiHandler`/`makeCrudRoute` (`proxy.ts` is only the optimistic first line). After changing `packages/core/src/http`, restart `next dev` (route bundles keep the stale `apiHandler`, so a new `authenticate` option silently does nothing until you do).
- Internal packages ship TypeScript source (no build step); `packages/app/next.config.ts` lists them in `transpilePackages`. Add any new internal package there.
- Add a dependency to the workspace that uses it (`npm install <pkg> -w @easyrms/<name>`), not the root.
- If the shell sets `NODE_ENV=development`, `next build` fails prerendering `/_global-error`; run it as `NODE_ENV=production npm run build`.

## QA PR evidence

Store all QA evidence for a PR (screenshots and any QA report files) in `doc/previdences/pr-<number>/`, with
numbered, descriptive filenames (e.g. `01-inbox-default.png`). Never put evidence in the repo root or elsewhere. Commit
it with the PR and reference these paths from the PR description or QA comment.

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

Exception: `.ai/specs/product-brief.md` is the product context (written by `om-discover` / `aa-product-brief`), not a spec. Keep its fixed name and location, because every `om-*` skill reads it from there; never date, move or archive it.

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
| `.ai/specs/product-brief.md` | Product context read by `om-*` skills | fixed name |
| `.ai/runs/` | Autonomous run logs | `YYYY-MM-DD-slug.md` |
| `.ai/lessons.md` | Index of lessons learned | — |
| `.ai/lessons/` | Deep-dive lesson writeups | `YYYY-MM-DD-slug.md` |
