# Engineering standards: adopt `engineering-standards.md` in EasyRMS

- **Date:** 2026-10-13
- **Status:** Implemented on branch `feat/engineering-standards` (browser check of the two client islands still pending, see Implementation notes).
- **Source:** `/engineering-standards.md` (repo root)

## Goal

Make the engineering standards binding for this repo and build the shared layers they
describe (typed errors, API handler, CRUD route builder, client `apiCall`, shared form/table/feedback
components), using the existing `returns` feature as the reference example, so every later concept reuses
them instead of re-inventing fetch/validation/error handling.

## Context: the source doc was written for a different product

`engineering-standards.md` was drafted against another project's scope ("DevMentor": mentors, bookings,
payments, JWT auth, `@devmentor/core`, `(student)/(mentor)` route groups, `docs/product-scope.md`). It must be
**adapted**, not copied. Where it contradicts `AGENTS.md`, `AGENTS.md` wins (those are decisions already made).

| Source doc says | EasyRMS reality | Resolution |
|---|---|---|
| Direction `app → core → db`, `ui` importable by `app` only | `app → ui, core, db`; `db → core` (types only); `core → nothing` | Keep AGENTS.md direction. |
| `ui/src/backend/` generic panel primitives, `ui/src/components/<concept>/` | `ui/src/admin/` (shadcn), `ui/src/public/` (Tailwind) | `backend/` → `admin/` (shadcn-based, generic); public equivalents go in `public/`. Concept-specific components: `admin/<concept>/` / `public/<concept>/`. |
| Concept folders: `entities/<concept>/x.entity.ts`, `services/<concept>/x.service.ts` | Flat today: `db/src/entities/return-request.ts`, `core/src/returns/return-service.ts`, `db/src/repositories/return-repository.ts` | See Naming below; one concept = `returns`. |
| `core/src/http/` with `apiHandler`, `makeCrudRoute` | `app/src/server/http.ts` has `errorResponse`; routes hand-roll `try/catch` | Build the layer (see Design). |
| Auth, JWT, bcrypt, cookies, CSRF, rate limiting, ownership checks, `requireSession` | No auth exists (explicitly out of scope so far) | Standards stay documented as **requirements for when auth is introduced**; no auth code in this spec. |
| Events emitter, payment `Gateway` port, `pino`, UUID ids, `env.ts` | None exist; returns use integer ids and `console.error` | Not built here (YAGNI). Port/adapter and event conventions are documented only. |
| `docs/product-scope.md` DI reconciliation | File does not exist; Awilix is already the decision | Skip. |
| Domain errors `NotFoundError` etc. in `core/src/http/errors.ts` | `core/src/errors.ts` has `ValidationError`, `NotFoundError` (extend `Error`) | Extend in place with an `AppError` base; keep location `core/src/errors.ts`. |

## Design

### 1. Docs and process (lands first, in its own commit)

- Move `engineering-standards.md` to `doc/engineering-standards.md` (decided by user; the doc's own `.ai/docs/` references are rewritten to this path) and rewritten to EasyRMS terms per the table above (product-specific examples → returns;
  auth/security sections kept but marked "applies once auth exists").
- Add to `AGENTS.md` (after "Monorepo layout"): **Domain concept convention** and **Reusable API & UI layer**
  subsections from the doc's Section 3, adjusted to EasyRMS paths; point to `doc/engineering-standards.md`.
- Add the Code Review Checklist as `doc/code-review-checklist.md` (or fold into a repo `CODE_REVIEW.md` if
  the agent pipeline expects one — check `.ai/agentic.config.json` if present).

### 2. Naming / structure (applied to the one existing concept, `returns`)

- `db/src/entities/return-request.ts` → `db/src/entities/returns/return-request.entity.ts`
- `db/src/repositories/return-repository.ts` → `db/src/repositories/returns/return.repository.ts`
- `core/src/returns/return-service.ts` → `core/src/services/returns/return.service.ts`; `types.ts` stays beside it
- Update `index.ts` barrels, `register.ts` files, imports. Table names, migration, and `Cradle` shape unchanged.
- Concept folders are created only with their first file; new services are registered explicitly in Awilix (no `loadModules`).

### 3. Server layer — `packages/core/src/http/`

Framework-agnostic: uses only Web-standard `Request`/`Response`; no `next`, no container import.

- `errors.ts` (re-exported from `core/src/errors.ts` or replacing it): `AppError` base with `status`/`code`;
  `NotFoundError`, `ValidationError` (with `fields`), `ConflictError`; `UnauthorizedError`/`ForbiddenError` added
  only when auth lands.
- `api-handler.ts`: `apiHandler(fn)` — maps `AppError` → status + envelope
  `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`, logs unexpected errors, never leaks
  stacks. Takes a logger via parameter/DI (no global logger in `core`).
- `make-crud-route.ts` (built now, decided by user): given schemas + service method references returns only the
  handlers configured among `{ GET, POST, PUT, PATCH, DELETE }` (each operation opt-in, so returns can expose list/create
  and a status-only PATCH without fake PUT/DELETE).
  The request-scoped service is obtained through an injected `resolveService` callback supplied by `app`
  (keeps the container out of `core`).
- `app/src/server/http.ts` (`errorResponse`) is deleted; `app/src/app/api/returns/**` become configuration over
  `makeCrudRoute`/`apiHandler`. Response shape changes to the envelope, so the client in step 4 changes with it.

### 4. Validation

- Shared schemas in `core/src/validators/<concept>/<name>-<action>.schema.ts`, used by the route and the form.
  First schema: `returns/return-request-create.schema.ts`, replacing the hand-written validation in
  `ReturnService.create`.
- Library: Zod (approved), installed in `@easyrms/core` only; `ui` receives schemas via props, not by importing `core`.

### 5. Client layer — `packages/ui/src/admin/` (+ `public/` where needed)

No imports from `core`/`app`/`db`; the envelope type is declared locally in `ui` (doc's "shape convention" note).

- `api/api-call.ts`: `apiCall` / `apiCallOrThrow`, defensive JSON parsing, sets a custom header (CSRF baseline
  for later). Only sanctioned `fetch('/api/*')` call site.
- `forms/crud-form.tsx`, `tables/data-table.tsx`, `feedback/{loading-message,error-message,empty-state}.tsx` —
  shadcn-based, props-driven, no data access. Public pages reuse the same primitives' logic via Tailwind variants
  only if a second public form appears (YAGNI).
- shadcn primitives only via `npx shadcn@latest add` (config already in `packages/ui/components.json`).
- Placement decision tree (primitive → generic → concept-specific → colocated) documented in AGENTS.md.

### 6. Reference refactor

- **Hybrid data flow (decided):** reads in Server Components, mutations through the form + `apiCall` → API routes.
  Server Actions are not used for mutations; `actions.ts` is removed once its callers are migrated.
- `/admin/returns` stays a Server Component for the list read (resolving `returnService` from the request scope) and
  renders it through `DataTable` (usable from a Server Component; interactive parts are client islands). Status changes
  are client islands calling `apiCall` → `PATCH /api/returns/[id]`, then `router.refresh()`.
- Public return form (`public/return-request-form.tsx`) submits through `CrudForm`/`apiCall` to `POST /api/returns`,
  validated by the shared schema; server `fieldErrors` render next to fields.
- Rule for later concepts: a read needed only for first render is a Server Component; any client-initiated read or
  mutation goes through `apiCall`. No new Server Actions.

### 7. Enforcement

- ESLint `no-restricted-imports` per package encoding the AGENTS.md dependency direction
  (`core` ⇢ no `next`/`react`/`@easyrms/db|ui|app`; `ui` ⇢ no `@easyrms/*` internals; only `db` imports
  `@mikro-orm/*`; no raw `fetch(` to `/api` outside `api-call.ts` via `no-restricted-syntax`).
  Lint currently runs only for `@easyrms/app`; add configs for the other packages and a root `lint` that covers all.
- Add a root `audit` script (`npm audit` at `--audit-level=high` semantics via `scripts/audit.mjs`, with an expiring allowlist) and to the validation gate; a finding at or above the
  threshold fails the build (decided by user).

### 8. Standards that are documented only (no code now)

Auth/security minimums (bcrypt ≥ 12, HS256 + ≥ 32-byte secret, cookie flags, CSRF header, rate limiting,
ownership checks, no mass assignment, fail-closed), ports/adapters, domain events (`concept.entity.action`),
transactions + unique constraints for check-then-act flows, idempotency, code-quality rules. Each becomes
enforceable in review via the checklist; each gets built when its first feature needs it.

## Implementation phases

1. Docs: move/adapt standards doc, AGENTS.md update, review checklist. (No code.)
2. Rename/move `returns` files into concept folders; typecheck + lint + `NODE_ENV=production npm run build`.
3. `core/src/http` (errors, `apiHandler`, `makeCrudRoute`) + Zod validator for returns; convert `/api/returns`;
   `/api/health` through `apiHandler`.
4. `ui/src/admin` client layer (`apiCall`, `CrudForm`, `DataTable`, feedback) + refactor `/admin/returns` and public form.
5. ESLint boundary rules across packages; `npm audit` in the gate.
6. Move this spec to `.ai/specs/implemented/` only after verifying each bullet against the tree and running the
   flow against a real DB (`npm run db:start && npm run db:migrate`) — see `.ai/lessons.md`.

Each phase leaves the app building and `/`, `/admin/returns`, `/api/returns`, `/api/health` working.

## Acceptance

- `npm run typecheck`, `npm run lint` (all packages), `NODE_ENV=production npm run build` pass.
- No route handler contains `try/catch` or builds an error `Response` by hand.
- No `fetch` to `/api` outside `api-call.ts`; ESLint fails if one is added.
- Creating a return with invalid input shows per-field server errors next to the right fields (shared schema both sides).
- Dependency-direction violations fail lint.

## Open Questions (all resolved)

1. ~~**Where does the doc live**~~ — **Resolved (user):** `doc/engineering-standards.md`.
2. ~~**Zod**~~ — **Resolved (approved by user):** add `zod` to `@easyrms/core` (`npm install zod -w @easyrms/core`) and add it to the AGENTS.md stack table.
3. ~~**Server Actions vs API + `apiCall`**~~ — **Resolved (user): hybrid.** Server Components for reads,
   `CrudForm` + `apiCall` → API routes for mutations and client-initiated reads (see Design §6).
4. ~~**`makeCrudRoute` now?**~~ — **Resolved (user): build it now**, with `/api/returns` as its first consumer.
   Returns is not plain CRUD (create/list/status-update only), so `makeCrudRoute` must support per-operation opt-in
   (only the handlers whose config is supplied are returned) and a custom update schema/method (`PATCH`, status only).
   Any operation that doesn't fit stays on `apiHandler` directly.
5. ~~**`npm audit`**~~ — **Resolved (user): it fails the build.** Added as a root script `audit` (`npm audit --audit-level=high`)
   run in the validation gate; threshold `high` is my default, say if you want `moderate` or any.
6. ~~**Response envelope change**~~ — **Resolved (user):** no consumers outside the app today, so the `{ ok, data }` envelope
   ships without a compatibility shim. Revisit if an external consumer appears.

## Implementation notes (2026-10-13)

Deviations and findings:

- **Audit gate:** the baseline was red (`next` critical advisories, `braces` high). Next and `eslint-config-next` were
  bumped to 16.4.0 (clears all Next advisories). `braces` has **no patched version** (`<= 3.0.3` is latest) and is reached only via
  `fast-glob` from `awilix` (we never call `loadModules`) and `@next/eslint-plugin-next` (dev-time lint). `npm run audit` is
  therefore `scripts/audit.mjs`: it runs `npm audit --json`, fails on any high+ advisory not in `audit-allowlist.json`, and
  each allowlist entry needs a reason and an expiry (the braces entry expires 2027-01-13; an expired entry fails the gate).
- **Public form** keeps the Tailwind `ReturnRequestForm` and submits via `apiCall` (client island
  `app/_components/submit-return-form.tsx`), not the shadcn `CrudForm`, because public pages use plain Tailwind (AGENTS.md).
  `CrudForm` is built and exported but has no consumer yet.
- **ESLint** config moved to the repo root (`eslint.config.mjs`) so it covers all packages; root `lint` is `eslint .`,
  `@easyrms/app` no longer has its own `lint` script.
- `makeCrudRoute` infers present operations from the config keys, so `export const { PATCH } = makeCrudRoute(...)` is
  type-checked and a missing verb is a compile error.
- Added `validateWith` (core) returning field errors without throwing, for client-side `CrudForm.validate`.
- Verified: typecheck, lint (boundary rules fire on deliberate violations), production build, and every `/api/returns*`
  and `/api/health` case via curl against a real DB. **Not verified in a browser:** the two client islands
  (`SubmitReturnForm`, `ReturnStatusActions`).
