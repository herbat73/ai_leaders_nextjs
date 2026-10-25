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

**Complaints** are a second kind (`kind = 'complaint'`) on the same requests, RMA sequence and timeline. A customer files one at `/returns/complaint/new` (defect description of 20-2000 characters, date the defect was noticed, optional serial number per item, remedy repair, replacement or refund; text only, no file upload yet). The window is 24 months from delivery (R02, not configurable) and non-returnable products may be complained about (R06); a unit held by an open return or complaint cannot be claimed again. A complaint adds the move `received` → `in_service` → `resolved`, and the agent records whether the defect is confirmed with the move to `received` (two buttons on the decision card). Complaint refunds carry no shipping deduction. For agents the deadline is 14 calendar days from submission (R04) with a red "Eskalacja" badge and a higher inbox position from day 10 (Q07) while the complaint is still `submitted`; nothing changes by itself when the deadline passes, and customers are only promised the usual two business days. `GET /api/returns` accepts `?kind=return|complaint`.

### Agent login

The back office needs a signed-in agent. `/admin/**` pages, `PATCH /api/returns/[id]`, `/api/discovery/**` and `/api/agents/**` (except login and invite acceptance) answer with a redirect to `/admin/login` (pages) or `401` (APIs) without a valid session. Agents sign in with e-mail and password (stored as `scrypt` hashes in the `agents` table); a session is a signed 8-hour cookie (`easyrms_agent`, secret `EASYRMS_AGENT_SESSION_SECRET`, see Configuration), separate from the customer's guest cookie. `proxy.ts` rejects requests without a validly signed token, and every page and route then loads the agent from the database, so disabling an agent takes effect on their next request. Each decision on the timeline names the agent (agents see the name, the customer tracker still says "team"). Login is throttled (10 attempts per minute per IP, 5 failures per 10 minutes per e-mail and IP, 20 failures per hour per e-mail whatever the IP; invite acceptance 10 per minute per IP) and every failure answers the same `invalid_credentials`. The per-IP budgets are only as good as `EASYRMS_TRUST_PROXY`: without a trusted proxy all clients share one bucket (anyone can trip the limit), and a proxy must overwrite, not append to, `x-forwarded-for`. The per-e-mail budget lets anyone lock a known address out of login for up to an hour; a manager can re-invite it.

**First agent and upgrades.** Nobody can sign in to invite the first agent, so create one from the command line (it prints a single-use invite link, valid 72 hours, to open in the browser and set a password):

```bash
npm run agent:create -- --email you@example.com --name "Your Name" [--base-url https://rms.example]
```

Run it before opening `/admin` on any database that already ran the older anonymous version, after `npm run db:migrate`. The same command re-invites an existing invited or disabled e-mail, which clears the password and ends its sessions (there is no self-service password reset). Invite links are also handed over on screen by an agent with the `MANAGE_RULES` permission (agent management arrives with the agents screen) and sent through the `MailPort`, which only logs today.

> **Before exposing the app publicly:** set `EASYRMS_AGENT_SESSION_SECRET`, terminate TLS in front of the app (the session cookie is `Secure` in production), and note the limits that remain: no password reset, no MFA, no login audit trail, logout and password changes only clear the cookie (a stolen cookie stays valid until it expires after 8 hours or the agent is disabled or re-invited), and the login throttle is in memory per process (a multi-instance deployment needs a shared store). The product brief asks for a security review of this login before public deployment.

### Customer portal

Customer routes: `/` (order number and e-mail lookup), `/returns` (overview of the order's requests), `/returns/new` (return wizard), `/returns/complaint/new` (complaint wizard) and `/returns/[rma]` (status tracker). They rely on a signed guest session cookie and the `OrderLookup` port. **Production has no working customer flow yet:** the fake order adapter fails closed in production, the real platform adapter is unscheduled, and agents have no authentication. Customer flows run under `next dev` until a real adapter exists.

### Case sample lab

`/admin/discovery/case-sample` takes an anonymised CSV of ~50 recent mail/phone cases (template at `/case-sample-template.csv`), computes the follow-up share, message counts and time to resolution, dry-runs rules R08–R10 (with what-if thresholds for R08/R09) and produces the `[DATA]` research note to commit under `.ai/specs/research/`. Nothing is stored and it needs no database. API: `POST /api/discovery/case-sample`. Needs no new configuration.

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

`npm run test:db` runs Vitest in `@easyrms/db` against the local PostgreSQL from `npm run db:start` (or the database in `EASYRMS_DATABASE_URL`). Every test file creates a throwaway schema (selected through `search_path`) and drops it afterwards, so your data is untouched. It covers the migrations (status mapping, RMA backfill order, `down` refusal, the items table) and the repository (compare-and-set transitions, events, concurrent submits under the order lock). It is not part of `npm test` or the CI gate until CI has a Postgres service, so record its result in `.ai/runs/` for each PR that touches `packages/db`.

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
| `EASYRMS_TRUST_PROXY` | unset (`false` in development and tests) | `true` or `false`; **required in production** (unset or any other value makes the first mutating request fail with an opaque 500 and a logged configuration error; `next build` is unaffected). `true` means a reverse proxy in front of the app overwrites `x-forwarded-host` (and `x-forwarded-for`): the CSRF check compares the `Origin` host with `x-forwarded-host`, and the client IP used for rate limiting (from the guest-session work) is the first `x-forwarded-for` entry. `false` means the `Host` header is used and all clients share one rate-limit bucket. A proxy that rewrites `Host` while the value is `false` makes every mutation (POST/PUT/PATCH/DELETE) return 403 `csrf_rejected` |
| `EASYRMS_ALLOWED_ORIGINS` | unset (none) | Comma-separated extra origins (`https://host[:port]`) the CSRF check accepts for mutating requests, in addition to the `Origin`-equals-host rule. Needed when chained proxies (e.g. a cloud sandbox URL in front of the dev server) hide the public host from both `Host` and `x-forwarded-host`, which otherwise makes every POST return 403 `csrf_rejected`. Read only by `app` (`server/http-options.ts`); put it in `packages/app/.env.local`, since Next does not load the root `.env` |
| `EASYRMS_ORDER_SOURCE` | `fake` in development and tests | Which order platform adapter looks up orders for returns. Only `fake` (seeded in-memory orders) exists today. **Required in production**, where `fake` always fails closed (no override): unset, `fake` or an unknown value is a configuration error on the first customer request (opaque 500, logged); `next build` is unaffected |
| `EASYRMS_GUEST_SESSION_SECRET` | unset | HMAC secret (at least 32 bytes) signing the 2-hour guest session cookie `easyrms_guest` (HttpOnly, SameSite=Lax, `Secure` in production). **Required outside development**: unset or shorter than 32 bytes is a configuration error on the first session request (opaque 500, logged; `next build` is unaffected). In development an unset value gives an ephemeral per-process secret with one console warning, so sessions end when the dev server restarts; to keep sessions across restarts, put a value in the git-ignored `packages/app/.env.local` (e.g. `EASYRMS_GUEST_SESSION_SECRET=$(openssl rand -hex 32)`) |
| `EASYRMS_AGENT_SESSION_SECRET` | unset | HMAC secret (at least 32 bytes) signing the 8-hour agent session cookie `easyrms_agent` (HttpOnly, SameSite=Lax, `Secure` in production). A different secret from `EASYRMS_GUEST_SESSION_SECRET`, plus a different cookie name and token audience, so a guest cookie never opens the back office and the reverse. **Required outside development** with the same fail-closed behavior as the guest secret (opaque 500 on the first login or invite acceptance, logged; `next build` is unaffected). In development an unset value gives an ephemeral per-process secret with one console warning. Behind plain `http` in production the `Secure` cookie is dropped by browsers, so login appears to succeed but no session is kept: terminate TLS at the proxy |
| `EASYRMS_REFUND_APPROVAL_LIMIT` | `2000` | Refund approval limit in PLN (`2000,50` or `2000.50`): approving a request whose resolution is a **refund** above this amount (not equal to it) needs an agent with the `MANAGE_RULES` permission; other agents get 403 `approval_required` and the decision card disables the approve button with the reason. Store credit and exchanges are never gated. An invalid value is a configuration error on first use (opaque 500, logged) |
| `EASYRMS_RETURN_WINDOW_DAYS` | `30` | Days after delivery during which a line can be returned, counted in calendar days in `Europe/Warsaw` (delivery day is day 0, so with 30 the last returnable day is delivery date + 30). Clamped to 14-365; a non-numeric value falls back to 30 |
| `EASYRMS_RETURN_SHIPPING_FEE` | `0` | Flat return shipping fee in PLN (`12,50` or `12.50`), deducted from refunds for the `parcel_locker` and `courier` return methods only; `store` drop-off and store credit are free. An invalid value is a configuration error (opaque 500, logged) |

> **Status:** the monorepo, database (MikroORM), DI (Awilix) and UI (Tailwind, shadcn/ui) foundations are in place, with a first return-request flow. See `.ai/specs/implemented/`.

## For AI coding agents

Architectural decisions and conventions are recorded in [`AGENTS.md`](./AGENTS.md). Read it before making changes.
