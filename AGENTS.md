# EasyRMS

**EasyRMS** (Easy Return Management System) manages product returns and complaints: a customer portal (Tailwind) and an
agent back office (shadcn/ui). npm-workspaces monorepo in `packages/{app,core,db,ui}`. Current features and
configuration: `README.md`; shipped specs: `.ai/specs/implemented/`.

## Hard rules

These are decisions already made. Do not swap alternatives in without the user's explicit approval; if a task conflicts
with them, stop and ask.

- **Stack:** Next.js App Router + React + TypeScript (strict, no `any` without a justifying comment, explicit return
  types on exports), PostgreSQL, MikroORM, Awilix, Zod schemas in `core`. Public pages use Tailwind, admin pages use
  shadcn/ui; no other component library or CSS framework.
- **Dependency direction** (no cycles; `npm run lint` enforces it): `app → ui, core, db`; `db → core` (types only);
  `ui` and `core` import nothing internal. `core` never imports React, Next.js or MikroORM. Reference packages by
  workspace name (`@easyrms/core`), never by relative path across packages.
- **Persistence** lives only in `db` (entities, repositories, migrations). No raw SQL or entity internals elsewhere.
- **DI:** register every service explicitly in Awilix (no `loadModules`, no `new Service()` in routes/components, no
  global container in `core`). Routes stay thin and resolve services from the container.
- **Data flow:** Server Components for reads; mutations and client reads go through API routes via `apiCall`. **No Server
  Actions.**
- **Concepts** (today: `returns`) are same-named folders across layers, created when their first file is added; there is
  no `modules/`.
- **Config and secrets:** configuration comes from environment variables, documented in the README; never commit secrets.
- **Dependencies** are added to the workspace that uses them (`npm install <pkg> -w @easyrms/<name>`), not the root.
- **Next.js here is not the one you know:** read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next.js code (details in `packages/app/AGENTS.md`).

## Process (mandatory)

- Check `.ai/specs/` for an existing spec before a feature; a non-trivial feature gets a spec, reviewed and approved,
  before code. Specs are `YYYY-MM-DD-slug.md` (real current date); a fully built one moves to `.ai/specs/implemented/`, an
  abandoned or superseded one to `.ai/specs/archive/`. `product-brief.md` is the exception: fixed name and place, never
  moved.
- Read `.ai/lessons.md` before non-trivial work. After a bug fix or a non-obvious finding, add a short entry (newest
  first); deep write-ups go to `.ai/lessons/YYYY-MM-DD-slug.md`, linked from the index.
- Every autonomous run (unattended, scheduled or long background work) writes a log to `.ai/runs/YYYY-MM-DD-slug.md`:
  what was tried, what changed, the outcome.
- After the user corrects you, add a short, specific rule here (or a lesson for a narrow gotcha). Merge near-duplicates,
  remove rules that turned out wrong.
- QA evidence for a PR (screenshots, reports) goes only in `doc/previdences/pr-<number>/` with numbered names
  (`01-inbox-default.png`) and is committed with the PR.
- Edit large files with `Edit`, not by rewriting them with `Write`; create a big file as a skeleton, then fill sections.

## Commands (run from the repo root)

- `npm run dev | build | start | lint | typecheck | test | audit | docs:check | storybook | storybook:build`
- Gate: `lint`, `typecheck`, `test`, `audit`, `docs:check`, `storybook:build`.
- `NODE_ENV=production npm run build` (with `NODE_ENV=development` the prerender of `/_global-error` fails).
- Database: `npm run db:start`, `db:migrate`, `db:migration:create`; `npm run test:db` needs the database and is outside
  the gate. First agent login: `npm run agent:create`. `npm run setup` bootstraps a fresh checkout.

## Task router

Read only the row that matches the task; add more rows' files when the task spans them.

| Task | Read |
|---|---|
| Bug fix | `.ai/lessons.md`, `doc/engineering-standards.md`, then the AGENTS.md of the package you touch |
| New feature | `.ai/specs/` (existing spec?), `.ai/specs/product-brief.md` (with `offset`/`limit` or grep, ~15k tokens), `doc/platform-primitives.md`, `doc/engineering-standards.md` ("adding a concept" checklist) |
| Look up a backlog id or issue number | `.ai/specs/backlog.md` (only the section you need) |
| Refactor | `doc/engineering-standards.md`, `BACKWARD_COMPATIBILITY.md`, the AGENTS.md of the package you touch |
| Review | `CODE_REVIEW.md`, `doc/code-review-checklist.md` |
| Ticket-to-PR flow, labels, claims | `SDLC.md` |
| Public API, DB schema or other contract change | `BACKWARD_COMPATIBILITY.md` |
| API route (`packages/app/src/app/api/**`, `packages/core/src/http/**`) | `.claude/rules/api.md`, `packages/app/AGENTS.md`, `packages/core/AGENTS.md` |
| Cross-cutting primitive (rules engine, money, state machine, ports, limiter, import) | `doc/platform-primitives.md` |
| Screen or UI component | `packages/ui/AGENTS.md`, `packages/ui/src/storybook/agent/dla-agenta-ai.mdx` |
| Migration, entity or repository | `packages/db/AGENTS.md` |
| Next.js page, proxy, auth, DI wiring | `packages/app/AGENTS.md` |
| Domain logic, validators, state machine | `packages/core/AGENTS.md` |
| Run the 50-case sample | `doc/instrukcja-proba-50-spraw.md` |
| Integration / E2E test (agent-browser scenario) | `.ai/skills/om-integration-tests/SKILL.md`, `doc/best-practices-testow-integracyjnych.md`, a scenario in `.ai/qa/RET/` as a model |
| Setup, configuration, env vars, deployment | `README.md` |

No dedicated doc exists yet for: the customer-portal (Tailwind) page patterns, and a CI pipeline (there is no
`.github/`).
