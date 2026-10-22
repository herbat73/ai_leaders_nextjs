# Code review rules

Applied automatically by `om-code-review` / `om-auto-review-pr`. The full repo checklist is `doc/code-review-checklist.md` (also set as `reviewChecklist` in `.ai/agentic.config.json`); standards live in `doc/engineering-standards.md`. Where they disagree with `AGENTS.md`, `AGENTS.md` wins. This file adds review priorities and severity guidance; it does not restate the checklist.

## Review priorities (in order)

1. **Correctness** — does the change do what the ticket/spec says, including unhappy paths? A behavior change ships a test that fails on the old code.
2. **Security** — input validation, secret handling, fail-closed decisions (see the Security section of the checklist).
3. **Contracts** — nothing in `BACKWARD_COMPATIBILITY.md` is broken without the required path.
4. **Architecture** — dependency direction, concept-folder layout, DI, reuse of the shared API/UI layer.
5. **Quality** — naming, types, dead code, comment density matching the surrounding code.

## Repo-specific checks

- **Dependency direction** (`app → ui, core, db`; `db → core` types only; `core` and `ui` import nothing internal). `core` must not import React, Next.js, MikroORM, or a global container. `npm run lint` enforces this; a lint disable on a boundary rule is a blocker unless justified.
- **Persistence** lives only in `packages/db`. No raw SQL or entity internals outside `db`; schema changes ship as a MikroORM migration in `packages/db/src/migrations`, never `schema:update`. One shared pool; `EntityManager` forked per request.
- **HTTP handlers** use `makeCrudRoute` / `apiHandler` from `@easyrms/core` (no hand-rolled `try/catch`), respond with the `{ ok, data } | { ok: false, error }` envelope, and parse an explicit Zod schema from `core/src/validators/<concept>/` — the raw body never reaches `em.create()` / `em.assign()`.
- **Client calls** go through `apiCall` / `apiCallOrThrow` (`@easyrms/ui/admin`), never raw `fetch('/api/*')`. Forms use `CrudForm`, lists use `DataTable`.
- **No Server Actions.** Reads in Server Components; mutations through API routes.
- **DI**: every service registered explicitly in Awilix (`packages/app/src/server/container.ts`); no `loadModules`, no `new Service()` in routes or components.
- **UI**: admin pages use shadcn/ui; public pages use plain Tailwind. No second component library or CSS framework. `ui` has no business logic or data access.
- **Next.js**: this version has breaking changes — new Next.js code must follow `node_modules/next/dist/docs/`, not memory. `"use client"` only when needed.
- **TypeScript**: strict; `any` needs a justifying comment; explicit return types on exported functions.
- **Config**: new env vars are documented in the README; no secrets committed.
- **Dependencies**: added to the workspace that uses it, not the root. New internal packages are listed in `transpilePackages`. `npm run audit` must pass; allowlist entries need a reason and expiry.
- **Process files**: `.ai/lessons.md` updated for non-obvious bug fixes; specs moved to `.ai/specs/implemented/` when fully built.

## Validation gate

`npm run typecheck`, `npm test`, `npm run lint`, `npm run audit`, `NODE_ENV=production npm run build` must all pass. A failing gate is a blocker finding, reported together with the code findings, not instead of them.

## Severity guidance

- **blocker** — broken dependency direction, missing migration for a schema change, unvalidated write input, secret leakage, an unparameterized query/shell/path, broken contract surface, failing gate.
- **major** — hand-rolled route/fetch/form where a shared piece exists, Server Action, service not in the container, missing regression test, fail-open behavior.
- **minor** — naming, comment/idiom drift, small simplifications.
- **nit** — taste; file as a follow-up, never block on it.

Findings quote the file and line and name the checklist item or standard they violate.
