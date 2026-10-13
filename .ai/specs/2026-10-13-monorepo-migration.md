# Monorepo migration

- **Date:** 2026-10-13
- **Status:** In progress (phase 1 implemented and verified; phases 2-4 pending)

## Goal

Move the bootstrapped single-package Next.js app into the npm-workspaces monorepo described in `AGENTS.md`, so all later EasyRMS work (MikroORM, Awilix, shadcn/ui) lands in the right package from the start.

## Scope

In scope (phase 1 — structure only):

- Root workspace config (`npm` workspaces over `packages/*`).
- Four packages: `@easyrms/app`, `@easyrms/core`, `@easyrms/db`, `@easyrms/ui`.
- Shared `tsconfig.base.json`.
- Move the existing Next.js app into `packages/app` with no behavior change.
- Update `AGENTS.md` and `README.md` status notes.

Out of scope (separate specs/PRs):

- Installing or configuring MikroORM, PostgreSQL, Awilix, Tailwind, shadcn/ui.
- Domain models, entities, migrations, DI composition root.
- CI, Docker, deployment.

## Design

### Layout

```
/
  package.json            # private root, "workspaces": ["packages/*"], delegating scripts
  tsconfig.base.json      # shared strict compiler options
  packages/
    app/   @easyrms/app   # Next.js app (moved from the repo root, unchanged)
    core/  @easyrms/core  # framework-agnostic business logic
    db/    @easyrms/db    # persistence (MikroORM later)
    ui/    @easyrms/ui    # reusable components
```

### Package rules

- Internal packages ship **TypeScript source** (`"main"`/`"types"` point at `src/index.ts`); no build step. `app` consumes them via `transpilePackages` in `next.config.ts`.
- Internal dependencies use `"*"` version ranges with workspace names (npm links them).
- Dependency direction is as in `AGENTS.md` (`app → ui, core, db`; `db → core`; `core`, `ui` depend on no internal package). In phase 1 `app` declares `core`, `db`, `ui`, and `db` declares `core`.
- Each package has a `tsconfig.json` extending `tsconfig.base.json` and a `typecheck` script.

### Root scripts

Root `dev`, `build`, `start`, `lint` run the `@easyrms/app` workspace; `typecheck` runs in all workspaces (`--workspaces --if-present`).

### Path alias

`@/*` in `app` still maps to `packages/app/src/*` (unchanged). Cross-package imports use workspace names, never relative paths.

## Risks

- Turbopack root detection: the root `package.json` with `workspaces` and a single root `package-lock.json` make the root the workspace root. Verify with `next build`.
- `.ai/`, `.agents/`, `.claude/` and other tooling stay at the repo root.
- `openmercato.toml` runs `npm run dev` at the root; the root `dev` script keeps that working.

## Phasing

1. **Structure (this spec)** — workspaces, package skeletons, move app, docs. Acceptance: `npm install`, `npm run typecheck`, `npm run lint`, `npm run build` pass; `npm run dev` serves the same page as before.
2. Database foundation (`@easyrms/db`): MikroORM + PostgreSQL, pool config, first migration. *Separate spec.*
3. DI composition root (`@easyrms/app` + `@easyrms/core`): Awilix container, per-request scope. *Separate spec.*
4. UI foundation: Tailwind, shadcn/ui in `@easyrms/ui`. *Separate spec.*

## Changelog

- 2026-10-13: Drafted; phase 1 implemented in the same change.
