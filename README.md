# EasyRMS

**EasyRMS** (Easy Return Management System) is a web application for managing product returns.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- PostgreSQL with [MikroORM](https://mikro-orm.io) (migrations, connection pooling)
- [Awilix](https://github.com/jeffijoe/awilix) for dependency injection
- [Tailwind CSS](https://tailwindcss.com) for public (customer-facing) pages
- [shadcn/ui](https://ui.shadcn.com) for admin (back-office) pages
- [ClamAV](https://www.clamav.net) (`clamd`) + [sharp](https://sharp.pixelplumbing.com) for malware scanning and metadata stripping on uploaded evidence images

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

**Transport damage and missing items** (`kind = 'transport' | 'missing'`, wizards at `/returns/transport/new` and `/returns/missing/new`) can be reported within `EASYRMS_TRANSPORT_WINDOW_DAYS` (default 14) of delivery, skip the return-shipping leg (`submitted` → `approved` → `resolved`, or `submitted` → `rejected`), and require 1–6 evidence photos (`POST /api/evidence`, served from `GET /api/evidence/[id]`). Every uploaded file (JPEG, PNG or WebP) is scanned in memory by **ClamAV** (`clamd` over TCP `INSTREAM`) and re-encoded with `sharp` to strip EXIF and other metadata **before** anything is written to PostgreSQL. Scanning fails closed: if `clamd` flags the payload, times out, cannot be reached, or `EASYRMS_CLAMAV_HOST` is unset in production, the upload is rejected (`503 scanner_unavailable` when down, `422 rejected` when infected or undecodable) and unscanned bytes are never stored (`T-16` in `doc/security/threat-model.md`). Stored photos are readable only by a signed-in agent or the order's guest session, and upload, pre-submit removal and agent-view audit events are recorded.

**Vendor claims** (`/admin/supplier-claims`, API `/api/supplier-claims`): once an agent has recorded `Wada potwierdzona` on a complaint, the decision card offers "Reklamacja do dostawcy": the agent picks an active vendor from `/admin/suppliers` (any agent may read the list, `MANAGE_RULES` creates, edits and deactivates; vendor guidelines are a note the agent reads, not an automatic check); the list shows 10 suppliers per page and can be narrowed by status (all, active, inactive) and by a part of the name and of the e-mail, state kept in the URL, optionally adds a note, previews the Polish e-mail and sends it. One claim per complaint (`SC-YYYY-NNNNN`), states `draft` → `sent` → `accepted` or `rejected`, then `accepted` → `credited`. The claim is stored as a `draft` first and becomes `sent` only after the mail server accepted the message; with the default `log` transport (or when the server refuses) it stays a `draft` and `POST /api/supplier-claims/[id]/send` retries it (409 `mail_not_configured` / 502 `mail_failed`). The e-mail goes from the shared address `EASYRMS_MAIL_FROM` with the sending agent in `Reply-To`, carries the order, product, serial number and defect text but never the customer's address. The agent records the vendor's answer on the claim page: acceptance with a credit amount not above the value of the claimed products, rejection with a reason of at least 20 characters, and later that the credit note was booked. There are no reminders and no accounting integration.

### Agent login

The back office needs a signed-in agent. `/admin/**` pages, `GET /api/returns`, `PATCH /api/returns/[id]`, `/api/discovery/**` and `/api/agents/**` (except login and invite acceptance) answer with a redirect to `/admin/login` (pages) or `401` (APIs) without a valid session. Agents sign in with e-mail and password (stored as `scrypt` hashes in the `agents` table); a session is a signed 8-hour cookie (`easyrms_agent`, secret `EASYRMS_AGENT_SESSION_SECRET`, see Configuration), separate from the customer's guest cookie. `proxy.ts` rejects requests without a validly signed token, and every page and route then loads the agent from the database, so disabling an agent takes effect on their next request. Each decision on the timeline names the agent (agents see the name, the customer tracker still says "team"). Login is throttled (10 attempts per minute per IP, 5 failures per 10 minutes per e-mail and IP, 20 failures per hour per e-mail whatever the IP; invite acceptance 10 per minute per IP) and every failure answers the same `invalid_credentials`. The per-IP budgets are only as good as `EASYRMS_TRUST_PROXY`: without a trusted proxy all clients share one bucket (anyone can trip the limit), and a proxy must overwrite, not append to, `x-forwarded-for`. The per-e-mail budget lets anyone lock a known address out of login for up to an hour; a manager can re-invite it.

**First agent and upgrades.** Nobody can sign in to invite the first agent, so create one from the command line (it prints a single-use invite link, valid for `EASYRMS_MANAGER_INVITE_TTL_HOURS` hours (8 by default) because it grants `MANAGE_RULES`, to open in the browser and set a password):

```bash
npm run agent:create -- --email you@example.com --name "Your Name" [--base-url https://rms.example]
```

Run it before opening `/admin` on any database that already ran the older anonymous version, after `npm run db:migrate`. The same command re-invites an existing invited or disabled e-mail, which clears the password and ends its sessions (there is no self-service password reset). Invite links are also handed over on screen by an agent with the `MANAGE_RULES` permission (agent management arrives with the agents screen) and sent through the `MailPort`, which only logs today.

> **Before exposing the app publicly:** set `EASYRMS_AGENT_SESSION_SECRET`, terminate TLS in front of the app (the session cookie is `Secure` in production), and note the limits that remain: no password reset, no MFA, no login audit trail, no idle timeout (a stolen cookie stays valid for up to 8 hours unless the agent logs out, is disabled or is re-invited; logout bumps the session epoch, so it signs the agent out on every device, and a replayed cookie gets 401), and the login throttle is in memory per process (a multi-instance deployment needs a shared store). The product brief asks for a security review of this login before public deployment.

### Customer portal

Customer routes: `/` (order number and e-mail lookup), `/returns` (overview of the order's requests), `/returns/new` (return wizard), `/returns/complaint/new` (complaint wizard), `/returns/transport/new` (transport-damage wizard), `/returns/missing/new` (missing/wrong-item wizard) and `/returns/[rma]` (status tracker). They rely on a signed guest session cookie and the `OrderLookup` port. **Production has no working customer flow yet:** the fake order adapter fails closed in production, the real platform adapter is unscheduled, and agents have no authentication. Customer flows run under `next dev` until a real adapter exists.

### Case sample lab

`/admin/discovery/case-sample` takes an anonymised CSV of ~50 recent mail/phone cases (template at `/case-sample-template.csv`), computes the follow-up share, message counts and time to resolution, dry-runs rules R08–R10 (with what-if thresholds for R08/R09) and produces the `[DATA]` research note to commit under `.ai/specs/research/`. Nothing is stored and it needs no database. API: `POST /api/discovery/case-sample`. Needs no new configuration.

`/admin/rules` (`MANAGE_RULES` only; others get 403 on the API and a notice on the page) lists the active rules R08–R10 (read-only, Polish description) and a threshold what-if: type other R08/R09 amounts and see how many existing requests the rules would settle, next to the current thresholds. It evaluates the stored requests (kind and resolution amount, at most 5000; requests without an amount are skipped), writes nothing and needs no new configuration. API: `GET /api/rules`, `POST /api/rules/simulate` (body `{ "thresholds": { "R08": "200,00" } }`).

### Database

PostgreSQL is accessed through MikroORM with a single shared connection pool. Schema changes are versioned migrations in `packages/db`.

## Getting started

Requirements, one-command setup, manual setup and the everyday commands are in [GettingStarted.md](./GettingStarted.md). Short version: `npm run setup`, then `npm run dev`, then open [http://localhost:3000](http://localhost:3000).

Evidence photo uploads (transport-damage and missing-item reports) also need the local **ClamAV** malware scanner container (`npm run setup` does not start it automatically; the first start takes a few minutes to download virus definitions):

```bash
docker compose up -d --wait clamav   # exposes clamd on 127.0.0.1:3310; without it uploads return 503
```

Tests, Storybook and configuration are described below.

### Database tests

`npm run test:db` runs the migration and repository tests of `@easyrms/db` against the local PostgreSQL; details in [DatabaseTests.md](./DatabaseTests.md).

### Integration tests

`npm run test:integration` runs the agent-browser QA scenarios from `.ai/qa/`; prerequisites, subsets and rate-limit notes are in [IntegrationTests.md](./IntegrationTests.md).

### Storybook

The component catalog (Storybook 10, `@storybook/nextjs-vite`) and the rules for writing stories are described in [Storybook.md](./Storybook.md).

### Configuration

Environment variables (database, proxy and CSRF, mail, order source, session secrets, ClamAV malware scanner, evidence quotas and retention, return rules and the rules recommendations switch) are documented in [Configuration.md](./Configuration.md).

> **Status:** the monorepo, database (MikroORM), DI (Awilix) and UI (Tailwind, shadcn/ui) foundations are in place, with a first return-request flow. See `.ai/specs/implemented/`.

## For AI coding agents

Architectural decisions and conventions are recorded in [`AGENTS.md`](./AGENTS.md). Read it before making changes.
