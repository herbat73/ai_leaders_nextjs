# Execution plan — return customer portal (one PR)

**Source spec:** `.ai/specs/2026-10-22-return-customer-portal.md`
**Branch:** `feat/return-customer-portal`
**Engine:** om-auto-create-pr-loop (`--loop`)

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.

| Phase | Step | Title | Exec | Status | Commit |
|-------|------|-------|------|--------|--------|
| 1 | 1.1 | CSRF check, trustProxy, response passthrough, new AppErrors | dispatch | done | 519bb01 |
| 1 | 1.2 | Items table: entity, expand-only migration, snapshot, migration tests | dispatch | done | 36e9ed0 |
| 1 | 1.3 | Domain types and repository support for items, resolution and order lock | dispatch | done | 333e9c8 |
| 1 | 1.4 | OrderLookup port and fake adapter | dispatch | done | 0d57a5a |
| 1 | 1.5 | Money addMoney/applyRate, eligibility and quote | dispatch | done | d08d4db |
| 1 | 1.6 | Rate limiter and clientIp | dispatch | done | e64c11c |
| 1 | 1.7 | Guest session service and cookie helper | dispatch | done | a822de1 |
| 1 | 1.8 | MailPort, mock adapter and transition hook | dispatch | done | af35aaf |
| 1 | 1.9 | Lookup and quote services, routes and flow tests | dispatch | done | 0bc215e |
| 1 | 1.10 | Submit service, route and flow tests | dispatch | done | 148acec |
| 1 | 1.11 | Real-database checks and scripted end-to-end run | dispatch | done | this |
| 2 | 2.1 | Public primitives with stories | dispatch | todo | — |
| 2 | 2.2 | formatDatePl, pluralPl and stage mapping | dispatch | todo | — |
| 2 | 2.3 | Tracker page /returns/[rma] | dispatch | todo | — |
| 2 | 2.4 | Lookup page, overview and html lang pl | dispatch | todo | — |
| 2 | 2.5 | Wizard components with stories | dispatch | todo | — |
| 2 | 2.6 | Wizard page /returns/new | dispatch | todo | — |
| 2 | 2.7 | Submit switch and legacy form removal | dispatch | todo | — |
| 2 | 2.8 | Agent card extension | dispatch | todo | — |
| 3 | 3.1 | README check, AGENTS.md and platform-primitives update | dispatch | todo | — |
| 3 | 3.2 | Acceptance walkthrough recorded | inline | todo | — |
| 3 | 3.3 | Brief bookkeeping and follow-up list | inline | todo | — |

## Goal
Ship the customer side of the first return slice (order lookup, return wizard, status tracker, backend, CSRF) on ONE PR.

## Scope
The whole spec. Owner decision 2026-10-23: one PR instead of the spec's five (A0/A/B/C/D); the spec's step order is kept. Step ids map to the spec: 1.1=P1 step 0, 1.2–1.3=step 1, 1.4=2, 1.5=3, 1.6–1.7=4 (limiter, session), 1.8=5, 1.9–1.11=6a–6c, 2.1–2.8=Phase 2 steps 1–6 (wizard split into components/page), 3.x=Phase 3.

## Non-goals
Everything the spec defers: real platform adapter, SMTP, CAPTCHA, retention (R16), auto-acceptance (R08), agent tracker preview, magic link, `.env.example`/`scripts/setup.mjs`, vitest in `ui`.

## Risks
- Breaking changes (all listed in the PR body): CSRF 403 on every mutating route; `EASYRMS_TRUST_PROXY` required in production; `POST /api/returns` request/response shape; removal of `ReturnRequestForm`/`SubmitReturnForm`/`/api/returns/submit`; `reason` nullable; `<html lang="pl">`.
- DB tests need a local Postgres (`test:db`, not in the gate); a local server is started from the system binaries when docker is unavailable.
- Production has no working customer flow (fake adapter fails closed, no real adapter, no agent auth); stated in the PR body.

## External References
none
