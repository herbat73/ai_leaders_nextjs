# 🔍 Pre-implementation analysis: Return customer portal: order lookup, return wizard, status tracker

**Readiness: conditional** — both earlier blockers (five missing oracles, `unknown`-status test in the wrong PR) are fixed and no Critical finding remains; what is left is a handful of Important plan gaps (startup-warning step, 400-vs-409 test wording, redirect re-pointing, wizard stories, `trustProxy` plumbing) that would cost rework or ambiguity if not added to the plan.
Spec: `.ai/specs/2026-10-22-return-customer-portal.md` (uncommitted working-tree revision, fourth audit; supersedes the previous report) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md` (all 5 surfaces), template: built-in section set (no `paths.specTemplate`, no template file), review checklist `doc/code-review-checklist.md`. Sibling specs read: `2026-10-22-return-agent-decision.md`, `2026-10-22-case-sample-lab-and-platform-primitives.md`.

## ⚠️ Decisions for the spec owner
- **Prerequisite specs are still not approved.** The Status line makes their approval and merge a start condition (correct), but `2026-10-22-case-sample-lab-and-platform-primitives.md` is still `Status: draft ... awaiting owner approval` and the agent spec has no `Status` line (P1–P3 were unconfirmed at the last audit). PR A cannot start until both are settled; `Money`, `Timeline`, `transition()` and `clock` come from them. Recommended: confirm both before handing this spec to `om-auto-implement-spec`.
- **Production has no working customer flow after PR C** (fake adapter always fails closed in production, real adapter unscheduled, legacy form removed at `/`). The spec states the guard and that the walkthrough runs under `next dev` but not the consequence. Recommended: accept, write it in the PR C body, do not deploy before the real adapter (no agent auth exists either).
- **Status line wording.** `Approved: decisions ...` is accepted as a ready value (repo defines none). It also says implementation starts after this audit returns go or conditional: this report satisfies that clause.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Line 3 `Status: Approved: ...`; conditional clause satisfied by this report. |
| R2 | No blocking open questions | ✅ | No Open Questions block, no unconfirmed `⚠` entry; S1–S7 and the R14 supersession recorded as owner-confirmed 2026-10-23 (record is the spec's own, not independently verifiable). |
| R3 | Traceability | ✅ (Important residual) | The five previously missing oracles are now present: session `DELETE` (step 6 flow test), migration `down` (step 1 check, incl. refusal when a null `reason` exists), `unavailable` not counted (step 6, "ten `unavailable` lookups then a normal one"), quote 400 `fieldErrors["items.<lineRef>"]` (step 6), `return_submitted` once and not on replay, replay with different payload (step 6). Residual: `proxyConfigWarning(env)` and its "tested in `core`" appear only in the Architecture rate-limiting bullet; no plan step lists the function, the test or the `app` startup hook that logs it once (Important, see Gaps). Still no requirement → oracle table (the per-step test lists are specific enough). |
| R4 | Contracts defined | ✅ (Important gaps) | Rows for `lookup`, `quote`, `submit`, `DELETE session`, `POST /api/returns`; the 400-vs-409 rule is now written (after the API table). Gaps: the step 6 flow test says "over-quantity 409" while the rule gives 400 for a quantity above `remainingQuantity` as read at that moment and 409 only for a loss inside the lock (see Gaps); `quantity ≤ remainingQuantity` is still listed among Zod request validations although it is server state. |
| R5 | Phases are deliverable | ✅ | `unknown` oracle moved to Phase 2 step 1 (PR B, "plus the agent spec's `unknown` status ... closed 'unknown' state with no stage marked done"); verified the agent spec defines `unknown` (its Edge Cases, badge "Nieznany"). PR A/B/C prerequisites and gates declared; "PR C = Phase 2 steps 2–6 and Phase 3", "removed in PR C step 5", Phase 3 steps 1–4 are numbered consistently. Wizard now names `POST /api/returns/submit` until step 5 (step 4) and step 5 re-points it. |
| R6 | Grounded in the codebase | ✅ | Verified against code: `apiHandler` (`packages/core/src/http/api-handler.ts`) takes `{ status, logger }` only and always builds `Response.json`, so the passthrough, CSRF check and `trustProxy` are real additions; `makeCrudRoute` builds `const options = { logger: config.logger }` and wraps every verb in `apiHandler`, so the option must be added to `CrudRouteConfig` and forwarded; container uses `globalThis.__easyrmsContainer` (`packages/app/src/server/container.ts:12`), so the spec's "held on `globalThis` like the container" is accurate; `LoadingMessage` default is `"Loading…"` (`packages/ui/src/admin/feedback/loading-message.tsx:3`), matching the spec's "its default is English"; `packages/app/src/server/` holds only `container.ts`, so `http-options.ts` is new as stated. |

## 🌐 Previous audit: item by item
| Previous finding | Status now | Note |
|---|---|---|
| Blocking 1 (R3 a): `DELETE /api/returns/session` oracle | **Resolved** | Step 6 flow test: 200, clears cookie, idempotent without cookie, CSRF-checked |
| Blocking 1 (R3 b): migration `down` | **Resolved** | Step 1 check names the refusal case and "changes nothing" |
| Blocking 1 (R3 c): `unavailable` not counted | **Resolved** | Step 6 |
| Blocking 1 (R3 d): quote 400 code | **Resolved** | Step 6 |
| Blocking 1 (R3 e): startup warning | **Partly resolved** | Function `proxyConfigWarning(env)` defined and "tested in `core`", but no plan step or hook; now Important, not Critical (the requirement, signature and oracle exist; only placement is missing) |
| R3 f/g: mail fired once, replay with different payload | **Resolved** | Step 6 |
| Blocking 2 / R5: `unknown` test in PR A | **Resolved** | Moved to Phase 2 step 1 (PR B); PR A no longer mentions it |
| Important: `globalThis` dev secret | **Resolved (text)** | Line 76 and step 4; there is no "two imports, same secret" test (Nice); the one warning does not yet name `NODE_ENV` (Nice) |
| Important: wizard submit target | **Resolved** | Step 4 and step 5 |
| Important: redirect re-pointing in step 5 | **Still open** | Step 3 redirects to `/returns/lookup`; step 5 removes that page but says nothing about re-pointing redirects and the expired-session link to `/`, and no acceptance covers it |
| Important: 400-vs-409 rule | **Resolved, with a new inconsistency** | Rule paragraph added; see New findings 1 |
| Important: `TRUST_PROXY` plumbing to `apiHandler` | **Resolved, with new nits** | `trustProxy?: boolean` option plus `httpOptions`; see New findings 2 and 3 |
| Important: UI loading, empty, mobile-first, Polish `LoadingMessage` | **Resolved** | UI/UX "Loading, empty and error states" bullet; `apiCall`'s English messages are mapped from `error.code` |
| Important: stories for wizard components | **Still open** | Step 4 names `ui/src/public/returns/` but no stories (AGENTS.md: every reusable `ui` component ships stories; `storybook:build` is in the gate) |
| Important: brief R14/R16 bookkeeping | **Resolved** | Phase 3 step 3 (R14 superseding entry, R16 deferred, follow-up issues); Phase 3 numbering 1–4 is consistent with PR C scope |
| Decision: production flow after PR C | **Still open** | Decisions above |
| Decision: prerequisite specs draft | **Still open** | Decisions above |
| Decision: Status wording | **Unchanged, accepted** | |
| Nice: step 4 garbled README sentence; `EASYRMS_ORDER_SOURCE` default sentence in step 4 though introduced in step 2 | **Still open** | Cosmetic |
| Nice: `public/wizard|tracker` path vs case-sample catalog | **Still open** | Cosmetic |

### New findings in this revision
1. **Important — "over-quantity 409" test vs the 400/409 rule.** The rule says a quantity above `remainingQuantity` as read at that moment is 400, and 409 only when a quantity available at lookup is found taken inside the lock. The server cannot know what the client saw at lookup, so the only deterministic split is pre-lock check (400) vs in-lock re-check (409). Step 6 says submit does "idempotency lookup, then quantity re-check, then insert" inside the lock and never states a pre-lock check, yet its flow test expects "over-quantity 409" and the pre-lock 400 is untested. Fix: state that submit checks window and returnable pre-lock and quantity inside the lock (so a sequential over-quantity submit is 400 or 409, pick one), reword the test to "concurrent over-quantity (mutex fake) → 409, sequential over-quantity → 400", and keep the Zod bound to structural limits only.
2. **Important (small) — two configuration paths for one variable.** `core` stays env-free (no contradiction: `clientIp(headers, env)` and `proxyConfigWarning(env)` take `env` as a parameter, and the CSRF check takes `trustProxy`), but `EASYRMS_TRUST_PROXY` is parsed in two places (`httpOptions` in `app` for CSRF, the raw `env` object for `clientIp`). Two parsers can disagree on `"true"` vs `"1"`. Fix: one `parseTrustProxy(env)` exported from `core`, used by both `http-options.ts` and `clientIp`.
3. **Important (small) — "nothing changes for existing callers" is not quite true for routes.** Existing routes (`packages/app/src/app/api/returns/route.ts`, `[id]/route.ts`, `health/route.ts`) must be edited to pass `httpOptions`; `makeCrudRoute` currently builds `options = { logger }` and must forward `trustProxy`. Default `false` keeps this additive and BC-safe (§3 internal packages: optional field), but a route that forgets it silently ignores `EASYRMS_TRUST_PROXY` and returns 403 behind a host-rewriting proxy. Fix: list the three existing routes in step 0 and add a test (or lint-level check) that `makeCrudRoute` forwards the option.
4. **Important — startup warning has no home.** Name where `app` logs `proxyConfigWarning(env)` once (for example the Next instrumentation hook or first container build) and add its `core` test to step 4.

## 💥 Backward compatibility
All five surfaces (§1 HTTP API, §2 Database, §3 Internal packages, §4 Config, §5 Process) re-checked against every phase (PR A, B, C). **0 Critical, 0 Warning.** The section's six rows still match the verified code. New edits introduce no new breakage: `trustProxy` is an optional `ApiHandlerOptions`/`CrudRouteConfig` field (additive), `Response` passthrough and `okResponse` are additive, `Money` additions are additive, the Phase 3 brief edit is not a protected surface. The CSRF 403 (classed breaking, listed for the PR A body), the `POST /api/returns` shape change and `/submit` add/remove (A/C), and `<html lang="pl">` (C) are documented with migration paths. Note, not a finding: BC §1's "add alongside for one release" is knowingly not followed (pre-1.0, same-PR consumers).

## 📝 Spec completeness
| Section | Missing / incomplete | Impact | What to add |
|---|---|---|---|
| Implementation Plan, Phase 1 step 4 | `proxyConfigWarning` function, test and startup hook not listed; garbled README sentence | oracle not placed (R3 residual) | add to step 4; fix sentence; move `EASYRMS_ORDER_SOURCE` default sentence to step 2 |
| Implementation Plan, Phase 2 steps 3/5 | redirect target `/returns/lookup` removed in step 5 | dead redirect after the switch | step 5: re-point redirects and the expired-session link to `/`, with acceptance |
| Implementation Plan, Phase 2 step 4 | wizard components have no named stories | AGENTS.md story rule, `storybook:build` gate | name the stories (states: ineligible line, error, pending) |
| API Contracts / Request validation | `quantity ≤ remainingQuantity` listed as schema rule | misleading; server state | move to service checks |

## 🔍 Repo-rule compliance
| Rule (source) | Spec location | Fix | Severity |
|---|---|---|---|
| AGENTS.md: every reusable `ui` component ships stories in `ui/src/storybook/` | Phase 2 step 4 | name stories for `ui/src/public/returns/` components | Important |
| Checklist: every changed behavior has a test | step 4 (`proxyConfigWarning`), step 6 (pre-lock 400) | add the two oracles | Important |
| AGENTS.md: `core` must not read env / framework | Architecture, step 0, step 4 | Satisfied (env passed as parameter, `trustProxy` option); unify parsing (New 2) | Nice |
| Product brief R14/R16 | Decisions in play, Phase 3 step 3 | Satisfied: supersession named, owner-confirmed, brief entry planned | none |
| Config rule: document new env vars in README | steps 0, 2, 3, 4 | Satisfied | none |

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|---|---|---|---|
| Prerequisite specs not approved (case-sample `draft`, agent spec unconfirmed) | High (mitigated by Status-line condition, not yet satisfied) | PR A cannot start; changes move `Money`, `Timeline`, `transition()`, `clock` | Confirm both siblings first |
| No working production flow after PR C | Medium | Customer flow unavailable in production | Owner accepted the guard; state in PR C body; do not deploy |
| Dev ephemeral secret and `NODE_ENV=development` on a real host (lessons 2026-10-13: the sandbox shell sets it) | Medium | Mis-set production signs with an ephemeral secret and allows the fake adapter | Warning names `NODE_ENV`; README note |
| CSRF on every mutating route, `Origin` vs `Host` behind a host-rewriting proxy | Medium | Mutations 403 until `EASYRMS_TRUST_PROXY=true` or a route forgets `httpOptions` | Documented in step 0; add forwarding test (New 3) |
| Shared IP bucket when `EASYRMS_TRUST_PROXY` unset | Medium | One stranger can exhaust everyone's lookups | Accepted; startup warning needs its step (New 4) |
| In-memory limiter per process | Medium | Weak across instances or restarts | `globalThis` holder; replace before scale-out |
| Hard-to-reverse contracts (items snapshot, resolution and reason-code values, 2 h session) | Medium | Long-term contracts | Stated in spec |
| Public `POST /api/returns/submit` from PR A to PR C with no UI | Low | Unused surface | Limiter and CSRF apply; keep A and C close |
| `jose` added to `core` and the audit gate | Low | `npm run audit` may fail on an advisory | Run `npm run audit` right after install |

## 🔍 Gaps
- **Important** — State the pre-lock vs in-lock checks at submit and fix the "over-quantity 409" test wording (New 1). Step 6, API Contracts.
- **Important** — Place `proxyConfigWarning` (test and startup hook) in step 4 (New 4).
- **Important** — Re-point redirects and the expired-session link to `/` in step 5 with an acceptance line.
- **Important** — Name stories for wizard components (step 4).
- **Important** — Single parser for `EASYRMS_TRUST_PROXY`; list the three existing routes and a forwarding test for `makeCrudRoute` in step 0 (New 2, 3).
- **Nice-to-have** — "two imports, same secret" test and `NODE_ENV` in the dev warning; move `quantity ≤ remainingQuantity` out of the schema list; `numeric(12,2)` string to `Money` mapping; mail template content; `fieldErrors` key for dotted `lineRef`; qualify remaining ambiguous ids (`Q02`, `A01`, `N3`); align `ui/src/public/wizard|tracker` with the case-sample catalog; tracker acceptance for the `unknown` state.

## 📋 Remediation plan
1. **Before implementation** — none mandatory. Owner: confirm or approve the two prerequisite specs (or accept in writing that PR A waits).
2. **During implementation (add to the plan)** — the five Important items under Gaps; `npm run audit` after adding `jose`; PR C body states the no-production-flow consequence and lists all breaking changes (BC rows 1–4).
3. **After implementation (follow-up)** — real platform adapter, SMTP adapter, CAPTCHA and retention with legal (R14/R16), agent tracker preview with agent auth, replace the in-memory limiter before scaling out.

## 🧪 Audit limits
- Read in full: the spec, the previous report, `AGENTS.md`, the `om-pre-implement-spec` SKILL.md and `report-templates.md`/`readiness-gate.md`; sibling specs by targeted search (status lines, `Money`, `unknown`, `transition`/`clock`) rather than end to end this round; `product-brief.md` R14/R16 rows. `BACKWARD_COMPATIBILITY.md`, `CODE_REVIEW.md`, `SDLC.md`, `doc/engineering-standards.md`, `doc/code-review-checklist.md`, `.ai/lessons.md`, `.ai/agentic.config.json` and the remaining reference files were relied on from the previous audit, not re-read.
- Code verified this round: `packages/core/src/http/api-handler.ts`, `make-crud-route.ts` (options shape), `packages/app/src/app/api/returns/route.ts`, `packages/app/src/server/` listing, `packages/app/src/server/container.ts` (`globalThis` pattern), `packages/ui/src/admin/feedback/loading-message.tsx`. Absence claims are scoped to those paths and the spec text.
- Not run: typecheck, tests, build, audit, database, tracker. No `.uxproof/` contract. The spec is an uncommitted working-tree revision; the owner-confirmation record on the Status line is taken from the spec text. No prompt-injection content found.
