# Backward compatibility

The surfaces below are protected contracts. `om-code-review` checks changes against this file, and implementation skills must warn the user when a change violates it. EasyRMS is pre-1.0 and every package is `private`, so the bar is "no silent breakage": a breaking change is allowed, but only through the required path listed here, stated in the PR body.

## 1. HTTP API (`packages/app/src/app/api/**`)

Surface: routes (today `/api/returns`, `/api/health`), methods, request shapes (Zod schemas in `packages/core/src/validators/`), and the response envelope `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.

- **Breaking:** removing/renaming a route or method; removing or renaming a response field; tightening a request schema (new required field, narrower type); changing an error `code` or HTTP status mapping; changing the envelope shape.
- **Non-breaking:** adding an optional request field, adding a response field, adding a route.
- **Required path:** update the schema and every consumer (`ui`, pages) in the same PR; call out the change in the PR body under a "Breaking changes" heading; prefer adding the new shape alongside the old one for one release before removal.

## 2. Database schema and migrations (`packages/db`)

Surface: tables/columns created by migrations in `packages/db/src/migrations`, and entity mappings.

- **Breaking:** dropping/renaming a table or column, changing a column type or nullability in a lossy way, editing or deleting an already-merged migration.
- **Required path:** a new MikroORM migration (never edit a merged one) with a working `down`; destructive changes split into expand → migrate data → contract across releases; the PR body carries a rollback plan. A schema change without a migration is a blocker.

## 3. Internal package APIs (`@easyrms/core`, `@easyrms/db`, `@easyrms/ui`)

Surface: whatever each package exports from its `src/index.ts` (and `@easyrms/ui/admin` subpath exports), including `apiHandler`, `makeCrudRoute`, `AppError` subclasses, `apiCall`, `CrudForm`, `DataTable`, and the DI registration functions.

- **Breaking:** removing/renaming an export, changing a signature or the meaning of an option, changing an `AppError` `status`/`code`.
- **Required path:** update every in-repo consumer in the same PR (lint and typecheck must pass); for a change to the shared `http` or `ui/admin` layers, check each existing route and page that uses it. Do not make `core` or `ui` import upward to satisfy a change.

## 4. Configuration and environment

Surface: environment variables documented in the README, `openmercato.toml`, `audit-allowlist.json` format, and the npm scripts in the root `package.json` (`dev`, `build`, `lint`, `typecheck`, `audit`, `db:*`).

- **Breaking:** renaming/removing an env var or npm script, changing a default in a way that alters runtime behavior.
- **Required path:** document the change in the README in the same PR; keep the old name working for one release when practical; never commit secrets.

## 5. Process contract

Surface: `.ai/agentic.config.json`, label taxonomy, `SDLC.md`, spec/run/lesson file naming (`YYYY-MM-DD-slug.md`).

- **Required path:** change the config and `SDLC.md` together; never rename or delete existing labels (see `.ai/trackers/github.md`).
