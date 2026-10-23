# 🔍 Pre-implementation analysis: Return customer portal: order lookup, return wizard, status tracker

**Readiness: conditional** — no Critical finding: the spec is approved, grounded in the real code, traceable and BC-compliant after the S8–S11 revision. Five Important items would cause rework or a red validation gate if not added to the plan: eager evaluation of `EASYRMS_TRUST_PROXY` would break `NODE_ENV=production npm run build`, the brief bookkeeping is stale, the lookup limiter key is not normalized, the `exchange` quote shape is undefined, and the migration snapshot is not mentioned.
Spec: `.ai/specs/2026-10-22-return-customer-portal.md` (working tree, fifth audit after the 2026-10-23 revisions S8–S11 and the PR A0 split; replaces the earlier report of the same name, which stays in git history) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md` (all 5 surfaces), template: built-in section set (no `paths.specTemplate`, no template file), review checklist `doc/code-review-checklist.md`. Siblings read: `2026-10-22-return-agent-decision.md`, `2026-10-22-case-sample-lab-and-platform-primitives.md`, `product-brief.md`.

## ⚠️ Decisions for the spec owner
- **R08 (auto-acceptance) is `active` in the brief but not implemented here (Q6).** The spec says its text is unchanged and every return goes to an agent. This is scope narrowing (D06 narrowed by Q13), not a contradiction, but a brief entry stays `active` while nothing builds it. Recommended: leave as is, note "deferred" in the brief when doing the bookkeeping below.
- **R16 stays `active` while retention is not built.** Stated openly in the spec (deferred, follow-up issue). Recommended: accept; the follow-up issue is already a Phase 3 step.
- **PR C is large** (tracker, lookup, overview, wizard, breaking switch, agent card, docs). It is one deployable behaviour change and is gated by a recorded walkthrough, so it passes R5; splitting the agent-card extension (step 6) into its own PR would shrink the blast radius. Optional.
- **Production has no working customer flow after PR C** (fake adapter fails closed in production, real adapter unscheduled, no agent auth). Spec states the guards and that the walkthrough runs under `next dev`; recommended to say it in the PR C body too.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Line 3 `Status: Approved: ...`; the conditional "after the audit returns go or conditional" clause is met by this report. Both prerequisite specs are also Approved/Confirmed (agent spec line 3, case-sample spec line 3). Neither is implemented yet (no `packages/core/src/domain/money.ts`, no state machine), so PR A0 can start now and PR A waits for their merges, as the spec says. |
| R2 | No blocking open questions | ✅ | No Open Questions block, no unconfirmed `⚠` entry; S1–S11, R14/D05 supersessions recorded as owner-confirmed 2026-10-23 (the record is the spec's own and the brief's `Decision summary`). |
| R3 | Traceability | ✅ | S8 (6a canonical-number flow test, 6c), S9 (`parseTrustProxy` cases in step 0), S10 (step 1 and 6c on the db runner), S11 (step 3 fee per method) each have an oracle. Residual (Important, below): the wizard "method before resolution" order and quote-for-`exchange` have no stated oracle. |
| R4 | Contracts defined | ✅ (gaps below) | Routes, request/response, error codes and validators are tabulated. UI covers loading, empty, error, session-expired states and primitives with stories. Gap: `exchange` quote response and limiter keying (see Gaps). |
| R5 | Phases deliverable | ✅ | Four PRs each with prerequisites and an observable gate (`npm test`, `storybook:build`, recorded `test:db`/walkthrough). |
| R6 | Grounded in the codebase | ✅ | Verified: `apiHandler` builds only `Response.json` and takes `{ status, logger }` (`packages/core/src/http/api-handler.ts`); `makeCrudRoute` passes only `{ logger }` and `create.handler(service, input)` cannot see the request (`make-crud-route.ts`); routes today are exactly `/api/health`, `/api/returns`, `/api/returns/[id]`; `apiCall` already sends `x-requested-with` and emits `network_error`/`unexpected_response`; nothing validates the header (S2 correct); `ServiceUnavailableError` (503 `service_unavailable`) exists, `Unauthorized`/`Forbidden`/`TooManyRequests` do not (additive); layout is `lang="en"`; `ui/src/public/` holds one component; `LoadingMessage` defaults to English; `ReturnRequest.reason` is `string` today and the admin page renders `item.reason`; `core` has Vitest, `db` has no runner (P5 of the agent spec adds it); no Next `cacheComponents`, so `export const dynamic = "force-dynamic"` is valid in Next 16.4.1 and `cookies()` is async (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`). Planned-not-built items (Money, Timeline, `transition()`, `clock`, `test:db`) are correctly attributed to the sibling specs and listed as prerequisites. |

## 💥 Backward compatibility
All five surfaces of `BACKWARD_COMPATIBILITY.md` audited against PR A0, A, B, C. The spec's own migration section covers them; the paths named comply.
| # | Surface | Phase/step | Change | Severity | Migration path |
|---|---------|------------|--------|----------|----------------|
| 1 | §1 HTTP API | A0 / step 0 | New 403 `csrf_rejected` on every mutating route (external scripts break) | Compliant (breaking, path named) | "Breaking changes" in the A0 PR body; consumers already send the header. |
| 2 | §1 HTTP API | C / step 5 | `POST /api/returns` request tightened, response shrinks to `{ rma, status, resolution, resolutionAmount }` | Compliant (breaking, path named) | New shape lives on `/api/returns/submit` since PR A (alongside, as the doc prefers), consumers switch in the same PR, removed fields listed in the PR body. |
| 3 | §3 Internal packages | A, C | `ReturnRequest.reason` nullable, `NewReturnRequest`/`returnRequestCreateSchema`/`ReturnService.create` removed, `ReturnRepository` grows, `apiHandler` options and passthrough, `ReturnRequestForm` removed | Warning (minor) | Spec says typecheck/lint pass in the same PR and names the exports; add the admin inbox `reason` column (`packages/app/src/app/admin/returns/page.tsx`) to the list of consumers to update, since new rows will have `reason = null`. |
| 4 | §4 Config | A0, A, C | Five new `EASYRMS_*` variables, `EASYRMS_TRUST_PROXY` required in production, `<html lang="pl">` | Compliant | README table per step; A0 body flags the proxy-host interaction. Gate impact in Risks. |
| 5 | §2 Database | A | Expand-only migration with working `down`, nullable relaxation is non-lossy, new unique and indexes | Compliant | Rollback plan stated (rollback loses items/resolutions). Add the MikroORM snapshot update (see Gaps). |
§5 Process contract: only `.ai/` bookkeeping and spec move; compliant.

## 📝 Spec completeness
| Section | Missing / incomplete | Impact | What to add |
|---------|----------------------|--------|-------------|
| Decisions in play / Phase 3 step 3 | Still speaks in the pre-confirmation voice: "Proposes to supersede D05", "record the D05 supersession once the owner confirms", "record the R14 supersession". The brief already holds R17 (supersedes R14, active), D08 (supersedes D05), D09 (supersedes D04) with the 2026-10-23 confirmation | Implementer would re-edit the brief and cite superseded entries as the basis ("Relies on ... R14") | Rewrite to cite R17, D08, D09 as the active decisions; reduce Phase 3 step 3 to "mark R16 deferred, note R08 deferred, open the follow-up issues, link the security-review gate"; drop "once the owner confirms". |
| API Contracts | `quote` response for `exchange` (no amount) and `submit`'s `resolutionAmount` for `exchange` undefined | Implementer must invent `null` vs omitted vs `0` | Add: `amountMinor`/`feeMinor`/`*Text` are `null` for `exchange`; `resolutionAmount: null`. |

## 🔍 Repo-rule compliance
| Rule (source) | Spec location | Fix | Severity |
|---------------|---------------|-----|----------|
| `AGENTS.md` conventions: "read configuration from environment variables"; spec's own step 0 "`core` never reads the environment" | Steps 2–3 ("env-driven config", `EASYRMS_ORDER_SOURCE` selecting an adapter in `core/src/adapters/orders/`) | State where env is parsed: `app` (container, `http-options.ts`) calls pure `core` parsers and passes plain config objects; adapter selection and the production guard sit in the composition root | Important |
| `doc/engineering-standards.md` §2 / checklist: "Cross-cutting primitives ... check `doc/platform-primitives.md`, update the row when a spec lands" | Phase 3 step 1 | Add: update the rows for the limiter, port/adapter, session and money additions in `doc/platform-primitives.md` | Important |
| `doc/engineering-standards.md` §5 "no raw SQL" with the agent spec's P4 (raw SQL limited to `nextval` and the migration) | Concurrency (`pg_advisory_xact_lock`) | The spec calls it "the single sanctioned raw statement", while agent spec P4 lists a different allowed set; reconcile the two lists so reviewers see one rule | Nice-to-have |

Checked and compliant: concept-folder placement, `apiHandler` direct use allowed by standards §2, no Server Actions, `apiCall` as the only client fetch, Awilix explicit registration with per-request scope, session cookie flags and JWT secret rule (standards §5), server recomputes money, migration with `down`, stories in `ui/src/storybook/public/` mirroring component paths, dependency direction (`jose` in `core`, advisory lock in `db`).

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| `httpOptions` is "one object" parsed with `parseTrustProxy`, and `apiHandler` destructures its options at route-creation time; if evaluated at module import, `NODE_ENV=production npm run build` (a validation-gate command, run with no env) throws a configuration error | High (unmitigated) | Red gate and red CI for PR A0 and everything after | Make resolution lazy (for example `trustProxy` accepts `() => boolean`, evaluated per request, or `httpOptions` is a function), and add a test or build check that the production build passes with the variable unset while the first request fails closed. Spec Edge Cases already says "on first use": the mechanism must match |
| CSRF host check behind a host-rewriting proxy with `EASYRMS_TRUST_PROXY=false` returns 403 for every mutation (admin included) | Medium | Outage on deploy | Already named in the A0 PR body and README; add it to the README row text |
| Shared bucket with `trustProxy=false` throttles all customers and lets a stranger exhaust a victim's failure budget | Medium | Availability; accepted | Documented, explicit setting required in production (S9) |
| DB integration suite outside CI (S10) | Medium | Lock or migration regression not caught by the gate | Result recorded in `.ai/runs/` per PR; add a Postgres service to CI when available |
| Retry after a lost response with edited wizard data returns the original request silently | Low | Customer sees confirmation of different items | The tracker shows what was recorded; consider a one-line notice when the replay's payload differs |
| In-memory limiter and stateless JWT (no revocation) | Low | Per-process, accepted for one instance | Stated in Risks |
| Agent auth absent, `GET /api/returns` and `/admin` public | High (pre-existing, mitigated by the stated deploy blocker) | Customer data exposure if deployed | Named blocker in agent spec close-out; do not expose publicly |

## 🔍 Gaps
- **Critical** — none.
- **Important** — Lazy `EASYRMS_TRUST_PROXY` evaluation (see Risks): specify the mechanism in Phase 1 step 0.
- **Important** — Failed-attempt limiter key: "5 failed attempts per 10 minutes per (order number, IP)" is keyed on the typed number, while S8 canonicalizes only after a successful lookup, so `ab-1`, `AB-1` and `AB-1 ` get separate budgets. Add: normalize the limiter key (trim, collapse whitespace, case-fold) in step 4 and test it; the per-IP 10/min limit remains the backstop.
- **Important** — `exchange` quote and submit response shape (see completeness).
- **Important** — Migration step 1 should update `packages/db/src/migrations/.snapshot-easyrms.json` (it exists; the agent spec's migration does so) and name the new entity `return-request-item.entity.ts` and its registration in `entities/index.ts`.
- **Important** — Brief bookkeeping rewrite (see completeness).
- **Important** — Env parsing location for window days, fee and order source (see compliance).
- **Nice-to-have** — Name the per-session limiter key for `quote`/`submit` (the JWT has no `jti`; keying on the canonical order number is the natural choice).
- **Nice-to-have** — Admin inbox shows an empty `reason` for new rows; show item count or first reason code, and handle `reason = null` in `packages/app/src/app/admin/returns/page.tsx`.
- **Nice-to-have** — Legacy rows store the typed (non-canonical) order number, so the overview will not list them for a canonical session; harmless (they hold no quantity) but worth one sentence under S5.
- **Nice-to-have** — A test oracle for the wizard step order (method before resolution) can only be manual; say so in Phase 2 step 4 acceptance.

## 📋 Remediation plan
1. **Before implementation** — edit the spec: lazy `trustProxy` mechanism and build check; limiter key normalization; `exchange` response shape; snapshot and entity file names in step 1; rewrite Decisions in play and Phase 3 step 3 to the R17/D08/D09 state; say where env is parsed.
2. **During implementation (add to the plan)** — verify `NODE_ENV=production npm run build` with `EASYRMS_TRUST_PROXY` unset in PR A0; update `doc/platform-primitives.md` rows in Phase 3 step 1; list the admin inbox as an updated consumer in PR A/C bodies; record `npm run test:db` results in `.ai/runs/`.
3. **After implementation (follow-up)** — real platform adapter, SMTP adapter, CAPTCHA, retention (R16), agent tracker preview, e-mail-link login, security review of R17's limits before any public deployment; add a Postgres service to CI.

## 🧪 Audit limits
Searched: `packages/core/src` (http, errors, services, validators), `packages/app/src` (routes, layout, page, admin page, `next.config.ts`), `packages/ui/src` (public, admin/api, feedback, storybook), `packages/db` (package, migrations dir incl. snapshot), root `package.json`, README config table, `.env.example`, `doc/engineering-standards.md`, `doc/code-review-checklist.md`, `BACKWARD_COMPATIBILITY.md`, `CODE_REVIEW.md`, `.ai/lessons.md`, product brief (R/D/N/Q entries), both sibling specs, Next 16.4.1 docs for `cookies()`, route segment config and `redirects`. Not run: no code executed, no build, no Postgres; `AGENTS.md` task router has no per-area guides beyond the standards file; no `.uxproof/` design contract exists; no `SDLC.md` or spec template found. The spec's claims about sibling-spec content were checked against those spec texts, not code (the code does not exist yet). Owner confirmations are taken from the spec and brief text and could not be verified independently. No prompt-injection directives found in the spec or guides.
