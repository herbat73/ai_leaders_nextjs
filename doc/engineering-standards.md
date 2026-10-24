# EasyRMS — Engineering Standards

Status: active. Spec: `.ai/specs/implemented/2026-10-13-engineering-standards.md`.

Where this file and `AGENTS.md` disagree, `AGENTS.md` wins. Sections marked **(when auth exists)** or
**(when needed)** are requirements for features that are not built yet; do not build them speculatively.

## 1. Naming and placement

| Element | Convention | Example |
|---|---|---|
| Package | `packages/<name>`, scoped `@easyrms/<name>` | `@easyrms/core` |
| Domain concept folder | plural single word, repeated across layers | `returns` |
| Entity | file `<name>.entity.ts` in `db/src/entities/<concept>/` | `entities/returns/return-request.entity.ts` |
| Repository | `db/src/repositories/<concept>/<name>.repository.ts` | `return.repository.ts` |
| DB table / column | snake_case, plural tables | `return_requests`, `created_at` |
| Service | `<Name>Service`, file `core/src/services/<concept>/<name>.service.ts` | `ReturnService` |
| Port (external integration) | `<Name>Gateway`/`Port`, file `<name>.port.ts`; adapters under `adapters/` | **(when needed)** |
| DI cradle key | camelCase, one explicit registration per dependency (no `loadModules`) | `returnService` |
| Zod schema | camelCase + `Schema`, file `core/src/validators/<concept>/<name>-<action>.schema.ts`, shared client/server | `returnSubmitSchema` |
| Event ID | `concept.entity.action`, past tense | `returns.return.created` **(when needed)** |
| API route | one `route.ts` per resource under `app/src/app/api/<concept>/` | `api/returns/route.ts` |
| Domain error | `<Name>Error` extending `AppError`, in `core/src/errors.ts` | `NotFoundError` |
| Route builder | `makeCrudRoute` or `apiHandler` from `@easyrms/core` | |
| Client fetch | `apiCall`/`apiCallOrThrow` from `@easyrms/ui/api` (public pages) or `@easyrms/ui/admin`, never raw `fetch` | |

Create a concept folder only when its first file is added. No `modules/` directory, no per-concept
setup/auto-discovery.

## 2. Reusable API and UI layer

Build a new shared piece only for a genuinely new pattern; never re-implement one inline.

**Server — `packages/core/src/http/` (Web-standard `Request`/`Response`, no `next`, no container import):**

- `errors.ts` — `AppError` base (`status`, `code`) with `NotFoundError`, `ValidationError`, `ConflictError`
  (`UnauthorizedError`/`ForbiddenError` when auth exists). Services throw these and never build HTTP responses.
- `api-handler.ts` — `apiHandler(fn, { logger })` maps `AppError` to a status and the envelope
  `{ ok: true, data }` / `{ ok: false, error: { code, message, fieldErrors? } }`, logs unexpected failures, never
  leaks stacks. Routes contain no `try/catch`.
- `make-crud-route.ts` — schemas + service references in, only the configured handlers of
  `{ GET, POST, PUT, PATCH, DELETE }` out. Workflow endpoints that don't fit use `apiHandler` directly.
- The request-scoped service comes from a `resolve` callback that `app` supplies (the container stays in `app`).

**Client — `packages/ui/src/admin/` (shadcn-based, props-driven, no data access):**

- `api/api-call.ts` — the only `fetch('/api/*')` call site; parses the envelope defensively, returns a typed
  `ApiResult<T>`, always sends the `x-requested-with` header (CSRF baseline). The envelope type is declared
  locally because `ui` must not import `core`.
- `forms/crud-form.tsx`, `tables/data-table.tsx`, `feedback/{loading-message,error-message,empty-state}.tsx`.
- Public (Tailwind) pages reuse `apiCall`; they get their own presentational components in `ui/src/public/`.
- Every reusable `ui` component ships a `<name>.stories.tsx` in `ui/src/storybook/`, mirroring its path (for example
  `storybook/admin/button.stories.tsx`), with one story per meaningful state (empty,
  loading, error, disabled, dark via the toolbar). Stories pass props only; callbacks use `fn()` from `storybook/test`.
  A spec's UI acceptance names the stories that show each new state. Every component also has a docs page
  (`ui/src/storybook/<same path>.mdx`) with the fixed sections checked by `npm run docs:check`; colours are semantic
  tokens only (see `ui/src/storybook/foundations/kolory-i-tokeny.mdx`).

**Data flow (hybrid):** reads in Server Components (resolve the service from the request scope); mutations and
client-initiated reads go through `apiCall` to API routes. No Server Actions.

**Where a reusable component goes:** (1) shadcn primitive → `ui/src/admin/` via `npx shadcn@latest add`;
(2) generic panel pattern → `ui/src/admin/<category>/`; (3) tied to one concept → `ui/src/admin/<concept>/` or
`ui/src/public/<concept>/`; (4) used by one page → colocate next to its `page.tsx` until a second page needs it.

**Cross-cutting primitives:** `doc/platform-primitives.md` is the map of platform primitives (built ones, the spec that builds each, and non-binding design sketches). Check it before adding a rules, money, state-machine, port/adapter, limiter, import or stat component, reuse what exists, and update the row when a spec lands. It does not approve a sketch; the first spec that needs one still does.

## 3. Architecture

- Dependency direction (enforced by ESLint): `app → ui, core, db`; `db → core` (types only); `ui` and `core`
  import nothing internal. `core` never imports `next`/`react`; only `db` imports `@mikro-orm/*`.
- Validation: one Zod schema in `core/src/validators/<concept>/`, used by the API route and the form.
- Integrations (**when needed**) go behind a port in `core` with a mock adapter first.
- Events (**when needed**): lightweight typed in-process emitter in `core/src/events`; no queues/workers.
- DB access stays on `force-dynamic` routes/pages; the app must build with no database reachable.
- Check-then-write on shared state runs in a DB transaction with a unique constraint where applicable.

## 4. Engineering principles

SRP (entity = schema, service = business rules, route = HTTP wiring only) · DRY (one schema, one fetch layer,
one error mapper) · layers don't leak · depend on ports, not vendor SDKs · explicit over implicit (every
registration written by hand) · YAGNI (no speculative folders/features) · composition over inheritance ·
fail closed on authorization errors · idempotency where retries can happen. When principles conflict, prefer
the smaller, more explicit change.

## 5. Security and validation minimums

Apply as the relevant feature appears.

- **Now:** no raw SQL concatenation (MikroORM APIs only; the only raw statements are parameterised and inside `db`: `nextval('return_rma_seq')`, `pg_advisory_xact_lock(hashtext(?))` in `withOrderLock`, and migrations); never spread a raw request body into
  `em.create()`/`em.assign()` — go through the parsed Zod output; no secrets, tokens or passwords in logs,
  responses or commits; secrets only via env (documented in README); `npm run audit` (high+, expiring allowlist in `audit-allowlist.json`) must pass.
- **(when auth exists)** bcrypt/bcryptjs cost ≥ 12 (upgrade path argon2id); agent passwords use dependency-free `node:crypto` scrypt (N=2^16, r=8, p=2, parameters stored in the hash) as accepted by the agent login spec; JWT HS256+ with ≥ 32-byte env secret
  and short expiry; `httpOnly`, `secure` in production, `sameSite=lax|strict` cookies, never `localStorage`;
  CSRF custom-header check on state-changing routes; rate limiting on login/register/reset; generic auth error
  messages; auth enforced server-side on every non-public route; per-record ownership checks (a missing
  ownership check is a blocker); authorization errors fail closed; server recomputes anything monetary.

## 6. Code quality

No `any` (narrow `unknown`) unless justified by a comment · comments only for a non-obvious why · early
returns over nesting · no empty `catch` (handle, log with context, or rethrow) · no magic numbers/strings ·
positive booleans, no bare `true`/`false` arguments · no dead or commented-out code or debug `console.log` ·
a PR's diff traces entirely to its purpose.

## 7. Adding a new concept

1. `db/src/entities/<concept>/<name>.entity.ts`, register in `entities/index.ts`, plus a migration.
2. Repository in `db/src/repositories/<concept>/`, registered in `db/src/register.ts`; port type in `core`.
3. `core/src/services/<concept>/<name>.service.ts`, registered in `core/src/register.ts`; add to `Cradle`.
4. Shared schema in `core/src/validators/<concept>/`.
5. API: `makeCrudRoute` for plain CRUD, otherwise `apiHandler`; in `app/src/app/api/<concept>/route.ts`.
6. Pages: Server Component reads; forms via `CrudForm` + `apiCall`; lists via `DataTable`; states via `feedback/`.
7. Check `ui/src/admin/` before writing any new component.

Review checklist: `doc/code-review-checklist.md`.
