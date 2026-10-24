# Execution plan — agent-login-and-roles

Date: 2026-10-24
Branch: feat/agent-login-and-roles
Source spec: .ai/specs/2026-10-24-agent-login-and-roles.md
Engine: om-auto-create-pr-loop (steps: 21, --loop: no, threshold exceeded)

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.

| Phase | Step | Title | Exec | Status | Commit |
|-------|------|-------|------|--------|--------|
| 1 | 1.1 | Password hashing (PasswordHasher port + scrypt adapter) | inline | done | c3e115d |
| 1 | 1.2 | Agent session service and secret resolution | inline | done | 4bf803a |
| 1 | 1.3 | Agent entity and migration | inline | done | 11630ed |
| 1 | 1.4 | Agent repository | inline | done | 746ead6 |
| 1 | 1.5 | Agent service and validators | inline | done | bf8230e |
| 1 | 1.6 | Composition and login/logout/accept routes | inline | done | 24ddb45 |
| 1 | 1.7 | First-agent command (agent:create) | inline | done | 14f9884 |
| 1 | 1.8 | Login and invite pages | inline | done | df71011 |
| 2 | 2.1 | authenticate hook in apiHandler and makeCrudRoute | inline | done | 4e933eb |
| 2 | 2.2 | agent-auth.ts guards and open-redirect sanitizer | inline | done | eccf2c2 |
| 2 | 2.3 | Guard the existing admin surface | inline | done | 1fafdfd |
| 2 | 2.4 | Identity on timeline events | inline | done | 3139361 |
| 2 | 2.5 | proxy.ts optimistic check | inline | done | eb303dc |
| 2 | 2.6 | Close the blocker (README, platform-primitives) | inline | done | 3eba0fd |
| 3 | 3.1 | List and invite API | inline | done | a2d6e00 |
| 3 | 3.2 | Disable API | inline | done | 9e5bc41 |
| 3 | 3.3 | /admin/agents screen | inline | done | 2d0a4e9 |
| 4 | 4.1 | R11 refund approval limit | inline | done | — |
| 4 | 4.2 | Shared tracker view | inline | done | — |
| 4 | 4.3 | Customer-view preview route | inline | done | — |
| 4 | 4.4 | Close-out (docs, lessons, run log, spec moved) | inline | done | — |

## Goal
Agents sign in with e-mail and password; admin pages and decision APIs require a session; timeline events name the agent; managers invite/disable agents; refunds above 2000 zł need `MANAGE_RULES`; agents get a read-only customer-view preview.

## Scope
The whole spec (4 phases) on one PR — owner decision 2026-10-24 (the spec itself proposed one PR per phase). Step titles map 1:1 to the spec's Implementation Plan; details live in the spec.

## Non-goals
`check:guards` script in the validation gate (needs separate owner approval), password reset, MFA, login audit, SSO.

## Owner decisions recorded for this run
- Whole spec on one PR.
- `tsx` approved as a devDependency of `@easyrms/app` (Step 1.7).
- Step 4.4: brief D10/D11 entries and Q15 closure need owner confirmation; R11 needs the finance reviewer — flag as outstanding in the PR, do not assume.

## Risks
risk-high: authentication, data scoping, schema migration. Breaking change: unauthenticated `PATCH /api/returns/[id]` and `/api/discovery/**` return 401 (Phase 2). Needs human QA reviewer and a second reviewer.

## External references
none
