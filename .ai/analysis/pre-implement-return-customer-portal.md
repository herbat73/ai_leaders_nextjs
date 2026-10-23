# 🔍 Pre-implementation analysis: Return customer portal: order lookup, return wizard, status tracker

**Readiness: go** — every item from the previous audit is resolved in the spec text and verified against the code and the sibling specs; no Critical or Important finding remains. Three Nice-to-have wording fixes can ride along with implementation.
Spec: `.ai/specs/2026-10-22-return-customer-portal.md` (working tree, re-audit after the revision that answered the previous report; replaces the earlier report of the same name, which stays in git history) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md` (all 5 surfaces), template: built-in section set (no `paths.specTemplate`, no template file), review checklist `doc/code-review-checklist.md`. Siblings read: `2026-10-22-return-agent-decision.md`, `2026-10-22-case-sample-lab-and-platform-primitives.md`, `product-brief.md`, `doc/platform-primitives.md`.

## ✅ Previous audit items: status
| Previous item | Now | Evidence |
|---|---|---|
| Important: eager `EASYRMS_TRUST_PROXY` evaluation would break `NODE_ENV=production npm run build` | Resolved | Phase 1 step 0: `trustProxy?: boolean \| (() => boolean)` evaluated per request, `httpOptions.trustProxy` is a memoized function never computed at import; explicit acceptance check (production build passes with the variable unset, first mutating request fails closed, `core` test with the function form). Matches the code: `apiHandler` takes its options at route creation (`packages/core/src/http/api-handler.ts`), `makeCrudRoute` passes only `{ logger }`, so step 0's forwarding edit is real and listed. |
| Important: limiter key not normalized | Resolved | Rate limiting bullet: key = trimmed, whitespace-stripped, case-folded order number; step 4 tests `ab-1`/`AB-1`/`AB-1 ` sharing one budget; quote/submit keyed on the canonical order number (the earlier Nice-to-have is also closed). |
| Important: `exchange` response shape | Resolved | API Contracts: `amountMinor`, `feeMinor`, `amountText`, `feeText` are `null` for `exchange`; `POST /api/returns` `resolutionAmount` is `null` for `exchange`. |
| Important: migration snapshot and entity file | Resolved | Step 1 names `return-request-item.entity.ts`, its registration in `entities/index.ts` (exists today with `returns/return-request.entity.ts`), `.snapshot-easyrms.json` (exists in `packages/db/src/migrations/`) and a "`migration:create` produces no diff" check (`db:migration:create` script exists). |
| Important: env parsing location | Resolved | Configuration bullet: `core` never reads env; `app/src/server/` parses and passes plain config; adapter choice and production guard in `container.ts` (exists at `packages/app/src/server/container.ts`). |
| Important: brief bookkeeping voice (R17/D08/D09) | Resolved | Decisions in play cites R17, D08, D09 as active; the brief holds them as `active` and D04/D05 as `superseded`. Phase 3 step 3 is reduced to marking R16/R08 deferred, follow-up issues and the security-review gate. |
| Important/compliance: `doc/platform-primitives.md` rows | Resolved | Phase 3 step 1 lists the rows to update; rows 13, 18, 23, 25, 26, 36–38, 42 already attribute the built-by-portal items consistently. |
| Nice-to-have: raw SQL vs agent spec P4 | Partly resolved | The portal spec now says the advisory-lock statement is "added to the agent spec's P4 list", but P4 in the agent spec still reads "Raw SQL is limited to `nextval` and the migration" (see N1). |
| Nice-to-have: admin inbox `reason = null`, legacy typed order number, wizard oracle manual | Resolved | Row 3 of the BC table names the admin inbox as an updated consumer; S5 states the legacy-number sentence; step 4 acceptance says "manual; no automated oracle". |

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | `Status: Approved`, owner confirmations dated 2026-10-23; prerequisite specs are Approved too. The "after the audit returns go or conditional" condition is met by this report. |
| R2 | No blocking open questions | ✅ | No Open Questions block, no unconfirmed `⚠` entry. |
| R3 | Traceability | ✅ | Each of S8–S11, the nulls for `exchange`, limiter normalization and the lazy `trustProxy` has a named test or acceptance check. |
| R4 | Contracts defined | ✅ | Routes, bodies, error codes, validators, states and primitives tabulated. |
| R5 | Phases deliverable | ✅ | Five PRs (A0, A, B, C, D) each with prerequisites and an observable gate; the per-PR prerequisites are consistent with the sibling specs (agent Phase 1 `transition()`/`clock`, Phase 2 step 1 `Timeline`, Phase 2 step 3 decision card; case-sample Phase 1 step 1 `Money`/`multiplyMoney`; agent P5 `test:db` runner). |
| R6 | Grounded in the codebase | ✅ | Re-verified: `apiHandler` builds only `Response.json`; routes today are `/api/health`, `/api/returns`, `/api/returns/[id]`; nothing validates `x-requested-with`; `TRUST_PROXY` appears nowhere yet; `db` has no test runner (agent P5 adds it); admin page renders `item.reason`. |

## 💥 Backward compatibility
All five surfaces audited against PR A0, A, B, C, D. The split does not change the picture: PR D only adds display to an agent page (additive, `ui`/`app` internal). Rows 1–5 of the spec's table comply (breaking changes carry a path: PR body "Breaking changes", alongside `/submit` until the same-PR consumer switch, expand-only migration with `down`). The earlier Warning (admin inbox consumer) is closed. §5 Process: only `.ai/` bookkeeping.

## 🔍 Repo-rule compliance
No violation. Re-checked: placement per concept folders, `apiHandler` used directly (standards §2), no Server Actions, `apiCall` the single client fetch, explicit Awilix registration, env parsed only in `app`, `jose` in `core`, advisory lock confined to `db` and parameterised, stories under `ui/src/storybook/public/`.

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| No agent authentication, `/admin` and `GET /api/returns` public | High (pre-existing) | Data exposure if deployed | Mitigated: named deploy blocker, close-out of the agent spec, PR bodies for C and D state there is no working production flow |
| Window between PR C and PR D: customers can submit (under `next dev` only) but the agent card shows no items, resolution or return method | Low | An agent could decide without seeing the lines | Production flow does not exist until the real adapter ships; merge PR D promptly after C or keep PR C unreleased |
| DB integration suite outside CI (S10) | Medium | Lock/migration regression not caught by the gate | Result recorded in `.ai/runs/` per PR (stated) |
| `trustProxy=false` shared bucket; host-rewriting proxy 403 | Medium | Availability; accepted | Explicit setting required in production (S9), README and PR A0 body |
| In-memory limiter, stateless JWT | Low | Per-process; accepted for one instance | Stated |

## 🔍 Gaps
- **Critical** — none.
- **Important** — none.
- **Nice-to-have N1** — Agent spec P4 (`2026-10-22-return-agent-decision.md` line 31) still says raw SQL is limited to `nextval` and the migration, while this spec adds `pg_advisory_xact_lock`. Have PR A (or the agent spec's close-out) append the advisory lock to P4 so a reviewer of either spec sees one rule; the standards text (`doc/engineering-standards.md` §5, "no raw SQL concatenation") is not violated by a parameterised statement.
- **Nice-to-have N2** — Stale wording from the PR split: TLDR says "each of the **three** PRs lists which parts of that spec..." while S1, Phasing and the plan define five (A0, A, B, C, D). Change to "each PR".
- **Nice-to-have N3** — BC row 3 says the admin inbox handles `reason = null` "(item count or first reason code)", but no step builds that data: items reach an agent only through the PR D card, and the inbox list item (agent spec `ReturnListItem`) carries no item data. State that PR A shows a placeholder (for example "—") for a null reason and PR D adds the items to the card only, or add the field to the list item explicitly.

## 📋 Remediation plan
1. **Before implementation** — optional: N2 (one word) and N3 (one sentence) in the spec.
2. **During implementation (add to the plan)** — N1 in PR A; verify `NODE_ENV=production npm run build` with `EASYRMS_TRUST_PROXY` unset in PR A0 (already an acceptance check); record `npm run test:db` results in `.ai/runs/`.
3. **After implementation (follow-up)** — real platform adapter, SMTP adapter, CAPTCHA, retention (R16), agent tracker preview, e-mail-link login, security review of R17/D08 before public deployment, Postgres service in CI.

## 🧪 Audit limits
Searched: `packages/core/src/http`, `packages/app/src` (routes, container, admin returns page), `packages/db` (package scripts, entities, migrations incl. snapshot), root and db `package.json`, `doc/engineering-standards.md`, `doc/platform-primitives.md`, `BACKWARD_COMPATIBILITY.md`, the product brief rows R08/R16/R17/D04/D05/D08/D09, and the two sibling specs (P4, P5, Phase 1/2 steps, Money step). Not run: no code, build, Postgres or browser; sibling-spec claims were checked against their text (the code does not exist yet). Owner confirmations are taken from the spec and brief text. Not re-read in full this run: Next 16 docs on `cookies()` and `force-dynamic` (verified in the previous audit, spec text unchanged there). No `.uxproof/`, `SDLC.md` or spec template exists. No prompt-injection directives found.
