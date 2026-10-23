# 🔍 Pre-implementation analysis: Case sample lab (E00-T01) and the platform primitives under it

**Readiness: no-go** — one readiness-gate item fails mechanically (R2): two defaults the spec itself still flags `⚠ NEEDS OWNER CONFIRMATION` (the metric definitions and R10b) have no recorded confirmation, and the Status line's blanket "Confirmed by the owner" explicitly excludes them. It is a single, cheap-to-clear blocker: with it cleared the verdict is **conditional** (Important gaps below), with no Critical finding left.
Spec: `.ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md` · issue #14 (not read from the tracker) · re-audit of 2026-10-23 (supersedes the earlier audit of the same day: no-go, status draft, gaps G1-G8) against BACKWARD_COMPATIBILITY.md, template built-in (no repo spec template), review checklist `doc/code-review-checklist.md`.

## ⛔ Blocking before implementation
1. **R2 — two unconfirmed `⚠` defaults** (metric definitions, line 52; R10b, line 156). Either the owner (and, for the metrics, the head of customer service) answers them and the spec records it, or the author takes the two defaults as accepted-for-build and removes the `⚠` from the spec body (see Decisions). See Readiness gate R2.

## ⚠️ Decisions for the spec owner
How the remaining `⚠` markers weigh under `readiness-gate.md` R2, judged honestly:
- **Letter of the gate.** R2 passes only when every unconfirmed `⚠` has a recorded human confirmation. The Status line says "Confirmed by the owner" but then says the two items "stay flagged there until the owner answers them specifically". That sentence is the spec admitting there is no confirmation for them, so a blanket confirmation cannot be read as covering them. (The markers are inline and worded `NEEDS OWNER CONFIRMATION`, not a `Resolved assumptions` block with `NEEDS HUMAN CONFIRMATION`; the gate's intent is the same, and I applied it rather than hiding behind the wording.)
- **Practical weight is low.** Neither default changes what gets built: the metric definitions are one table encoded in `CaseSampleService` plus its tests, and the spec places the confirmation at "before the note is read against A01/A04", i.e. after the build. R10b is one `kind_in [complaint]` condition and affects only `matchedByRule` counts, never the settled share (R10 does not settle). Reversal cost is small either way. This is why the verdict is a single fixable no-go and not a design problem.
- **Decision 1 (metric definitions).** Question: do the head of customer service and the owner accept follow-up share = all cases incl. open; settled share = all cases incl. cancelled/open, with a resolved-only share beside it; agreement as counts only? Recommended: accept as is (they are conservative and both denominators are shown). Tradeoff: if the head of customer service wants resolved-only as the headline, the tile and note wording change, not the engine.
- **Decision 2 (R10b).** Question: keep `complaint ∧ electronics/appliances → video`, or encode the brief's literal "elektronika/AGD → wideo" (any kind)? Recommended: encode the brief literally (drop the `kind_in [complaint]`), since R10 in the brief (line 126) says nothing about complaints and the concept source (docs/02 §2.8) is not in this repo to justify the restriction. Tradeoff: more `require_evidence` matches for returns of electronics; no effect on A04.
- **Cleanest way to clear both.** Record the owner's answer in the spec, or move the metric confirmation out of the spec into the note itself as a "not agreed" remark (the same device the spec already uses for the kill line) and delete the `⚠` from the spec body. Do not leave a flag in a spec whose Status says Confirmed: sibling specs (agent decision, portal) carry no such flags and read `Approved`.
- **Status wording (R1, informational).** `SDLC.md` and `doc/` define no list of ready values for specs. The siblings say `Approved`; this one says `Confirmed by the owner in session on 2026-10-23`. That is an unambiguous approval statement, so R1 passes; using the word `Approved` would match the siblings and make a later status check trivial.
- **Scope cohesion** (unchanged): feature plus a non-binding catalog. No split recommended; "Approving this spec does not approve them" is now stated in the catalog intro.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Line 3: "Confirmed by the owner in session on 2026-10-23 (revised after review the same day)". Repo defines no ready vocabulary (`SDLC.md` has none); this is an explicit approval. Prefer `Approved`, as the siblings do. Previous audit's R1 failure is resolved. |
| R2 | No blocking open questions | ❌ | No `Open Questions` block; Q1-Q7 and Language resolved by the owner. But the metric definitions (line 52) and R10b (line 156) are still `⚠ NEEDS OWNER CONFIRMATION` with no recorded confirmation. Regressed from the earlier audit (new markers introduced by the review edits). Fix: see Decisions 1-2. |
| R3 | Traceability | ✅ (weak) | Metric definitions table now gives every metric a numerator and denominator, and tests are listed against it (Phase 2 step 2), so oracles are derivable by hand. Weak spot unchanged: fixture rows and expected values are not in the spec (G5). |
| R4 | Contracts defined | ✅ | Response shape now unambiguous (Interval vs plain `share`, agreement `{ agrees, falseApprovals, other }`, `settledShareResolved`); 413/400 split defined; `DataTable` caption behavior exact; export list present; CSRF dependency stated. Remaining nits are G9-G12. Auth: "no admin auth" stated. |
| R5 | Phases deliverable | ✅ (weak) | Four ordered phases, each step ends with the gate. Phasing still has no per-phase "Dependencies:" line or observable exit gate (G4), unlike the two sibling specs. |
| R6 | Grounded in the codebase | ✅ | Re-verified against code: `parseJsonBody(request, schema)` has no cap today and `http/index.ts` re-exports `parse`, so the optional third argument is additive; `PayloadTooLargeError` fits `core/src/errors.ts` (exported by `index.ts`); `registerCore` registers `returnService` as `.scoped()`, a `.singleton()` addition is valid under `InjectionMode.PROXY`/`strict`; `Cradle` and `resolveReturnService` are in `app/src/server/container.ts` as described; `DataTable` returns `EmptyState` before any `<table>`, exactly as the spec's change description assumes; `apiHandler` maps `AppError` as the spec relies on; `app/public/` has no template (path free); `papaparse` is not installed yet (spec adds it). No mis-description found. |

## 💥 Backward compatibility
All five surfaces of `BACKWARD_COMPATIBILITY.md` checked against all four phases. No Critical, no Warning. Unchanged from the earlier audit; the new edits add nothing breaking.

| # | Surface | Phase/step | Change | Result |
|---|---------|------------|--------|--------|
| 1 HTTP API | P2.4 | new `POST /api/discovery/case-sample`; new code `payload_too_large` (413) only on the new route | additive. Note: it will be subject to the portal's CSRF check once that lands (new route, no existing caller affected) |
| 2 DB schema | all | none | untouched |
| 3 Internal package APIs | P1, P2.1, P3.1 | new `core`/`ui/admin` exports; `parseJsonBody` optional `maxBytes` (no-cap path tested as unchanged); `DataTable` optional `caption` (output without it byte-identical, specified and to be storied); new `AppError` subclass | additive |
| 4 Config / env | P1.4 | `papaparse` dependency; no env or script change | additive; `npm run audit` must pass (not run here) |
| 5 Process contract | P4 | spec moves to `implemented/`, same name | untouched |

## 📝 Spec completeness
| Section | Missing / incomplete | Impact | What to add |
|---------|----------------------|--------|-------------|
| Phasing | No per-phase dependencies or exit gates | implementer decides when a phase is "done" | G4 |
| Test coverage | Fixture rows and expected values absent | oracle is self-generated | G5 |
| Migration & BC | No dedicated section; Risks says additive and that is accurate | none | optional one line naming the `DataTable`/`parseJsonBody` byte-identical guarantee (already in Phase tests) |

## 🔍 Repo-rule compliance
| Rule (source) | Spec location | Fix | Severity |
|---------------|---------------|-----|----------|
| Product brief D07, Polish-only app (`.ai/specs/product-brief.md` line 155) | UI/UX, Edge Cases, API Contracts | Spec adopts D07 and Polish copy, but shared code the lab reuses still emits English (G9). Name the Polish strings the lab passes and the messages it must override. | Important |
| `doc/engineering-standards.md` §2 rule 4 (colocate single-use) and §4 YAGNI | Risks | Declared, owner-approved deviations with named second consumers. No action. | Info (declared) |
| AGENTS.md "every service registered explicitly, no `loadModules`" | Wiring | Singleton `asClass` registration, stated reason. OK. | — |
| Checklist: client-supplied money revalidated server-side | API | Thresholds are strings parsed by `parseMoney` on the server. OK. | — |
| AGENTS.md "no `any`", explicit return types, Storybook stories per reusable `ui` component under `ui/src/storybook/` | Phase 3.1 | Stories named per state. OK. | — |

Product brief protected entries: R08/R09/R10 values (15000, 6000, 200000 minor units) match brief lines 124-126; D07 honored; N01-N04 untouched (N04 resolved by D07 wording); A01/A04 targeted as written; no contradiction of an active entry.

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| Personal data reaches a committed note via a heuristic guard | Medium | Whitelist, `cellGuard`, bands/months-only note, no-cell-value-in-errors test all specified | Already mitigated; keep the tests |
| Rule vocabulary and `Money`/`ClaimKind` harden through reuse before B-05 confirms them | Medium | Later specs build on unvalidated shapes | Spec says provisional and nothing stores them; carry the sentence into `doc/platform-primitives.md`. Note the agent spec does not actually consume `ClaimKind` (G10) |
| Lab merges before the portal's CSRF step 0, which names only three existing routes | Medium | The lab route could be left without `httpOptions` (proxy host check wrong behind a proxy, `trustProxy` defaults false) | G11 |
| Unconfirmed metric definitions change how A01/A04 are read | Low | Note read against the wrong denominator | Both denominators already shown; resolve Decision 1 |
| `papaparse` audit/advisory red gate | Low | Gate red at P1.4 | `npm run audit` immediately after install (lessons.md Storybook entry) |
| Lab 500s when Postgres is down | Low | Accepted and documented | — |
| `DataTable` change regresses `/admin/returns` | Low | Specified exactly; story for both paths | Keep the existing page unchanged |

## 🔍 Gaps
- **Critical** — none beyond R2 (above).
- **Important G4 (open, from earlier audit) — phase dependencies and exit gates.** Phasing lists scope only. Add, as the siblings do: "Phase 2 needs Phase 1 merged; exit: `npm test` green incl. the metric-definition tests", "Phase 3 needs Phase 2; exit: `storybook:build` green and the recorded manual walkthrough", Phase 1 "no dependencies, app unchanged".
- **Important G5 (open, partly improved) — fixture and expected values.** The metric table is now the oracle source, but the ~12-row fixture is not defined and the expected values are "recorded in the test and in `.ai/runs/`" by the implementer, i.e. taken from the implementation's own output (circular). Put the fixture rows and hand-computed expected values (tiles, `byOutcome`, agreement for `keep_item`, resolved-only share) in the spec, or require them to be computed by hand before running and committed as the oracle. Same for the Phase 3.2 "expected tiles".
- **Important G9 (new, from re-audit "leftover English strings", partly resolved) — English text still reaches the Polish UI.** Lab-owned strings are now Polish (note title, buttons, row errors, "Jeszcze N błędów", encoding hint), which resolves the earlier finding for those. Still English and reachable: `apiCall` fallbacks "Network error. Please try again." and "Request failed (N)" (`ui/src/admin/api/api-call.ts`), `parseJsonBody`'s "Invalid JSON body" and `parseWith`'s default "Invalid input" (`core/src/http/parse.ts`), the `apiHandler` 500 "Internal server error", `LoadingMessage`'s default "Loading…" and `DataTable`'s default "Nothing to show yet.". The new `PayloadTooLargeError` message language is unspecified. Also unspecified: where the Polish labels for the raw `kind`/`channel`/`outcome` ids in `byKind`/`byChannel`/`byOutcome` are mapped (the response sends ids; `ui` has no strings), and the tile labels, column headers and captions (the spec says "the strings below are the Polish source text" but lists only some). Fix: state that the lab page passes Polish `message`/`emptyMessage` props, that a client-side mapping of `apiCall` error codes (`network_error`, `payload_too_large`, `validation_error`) to Polish text lives in the lab component, give the `PayloadTooLargeError` message in Polish, and name the label map's home (`app` page component).
- **Important G10 (new) — catalog mis-states the agent spec.** Layout says `CLAIM_KINDS` is used by "the agent spec's `kind` column". The agent spec types `kind` as the literal `"return"` for now and says there is no code dependency on the lab. Reword to "a later spec widens it to `ClaimKind`", so the catalog does not invent a consumer.
- **Important G11 (new) — CSRF handshake across specs.** The lab states it is covered by the portal's step 0, which is right (`apiHandler` applies it to every mutating route, and `apiCall` already sends `x-requested-with`). But the lab merges first (Q7) and the portal's step 0 enumerates "the three existing routes" for `httpOptions`; the lab route becomes a fourth. Add one line to the lab (route passes `httpOptions` once step 0 lands) and ask the portal spec to say "every route under `app/api`". Also note the lab's manual `curl` check (Phase 2.4) needs `-H 'x-requested-with: easyrms'` after step 0.
- **Nice-to-have G12 — duplicate `definitions`.** The response has `rules.definitions` and `rules.baseline.definitions`; they are the same list for the baseline. State that the top-level one is the baseline's (or drop it; the intro card renders from `describeRule` server-side anyway).
- **Nice-to-have G13 — catalog names vs the portal spec.** Catalog lists `Wizard / stepper` in `ui/src/public/wizard/` and `StatusTracker` in `ui/src/public/tracker/`; the portal builds `Stepper` and `StageList (StatusTracker)` flat in `ui/src/public/`. The agent spec builds `overdue` as well as `addBusinessDays`/`dueAt`; the catalog sketch lists `overdue` under "stays design". Align names or mark the rows as indicative (they are already non-binding). The portal also adds `addMoney` next to `applyRate`; Q7 mentions only `applyRate`.
- **Nice-to-have G14 — `DataTable` caption wiring.** `ui/src/admin/table.tsx` has no `TableCaption` (only `caption-bottom` on `Table`); say whether the caption is a plain `<caption>` or a shadcn `table` re-add.
- **Nice-to-have G15 — 1 MiB cap wording.** "JSON escaping can nearly double the size" holds for `\n` and `"` but control characters escape to up to 6 bytes. Irrelevant for a legitimate CSV; say "for a legitimate CSV" so the 413/400 boundary claim is not read as a guarantee.
- **Nice-to-have G6 (open) — guard false positives.** Add one sentence telling the user what to do when the 9-digit guard hits an internal id in a dropped column (remove the column and re-upload).
- **Nice-to-have G7 (open) — pl-PL formatting.** Phase 1 step 1 says "pl-PL formatting" only; pin the expected string including the non-breaking space and note it relies on Node's ICU.

## 📋 Remediation plan
1. **Before implementation** — resolve R2 (Decisions 1-2: owner answers, or demote the metric confirmation into the note's "not agreed" remark and delete both `⚠`); then in the same revision: G4 exit gates, G5 fixture values, G9 Polish strings and label map, G10 and G11 wording. Re-audit expected: conditional or go.
2. **During implementation (add to the plan)** — hand-compute the fixture oracle before running the service; run `npm run audit` right after adding `papaparse`; verify `/admin/returns` renders unchanged (story or screenshot); G12-G15 as spec/code cleanups in the same PRs.
3. **After implementation (follow-up)** — G6, G7; confirm the rule vocabulary and `ClaimKind` with the B-05 spec; the head of customer service reads the note only after Decision 1 is recorded.

## 🔄 Walk-through of earlier findings
| Earlier finding | Now | Notes |
|---|---|---|
| R1 status draft (Critical) | Resolved | Status line is an explicit owner confirmation (see R1) |
| R2 no blocking open questions (was ✅) | **New: failed** | Introduced by the review edits: two flagged defaults, unconfirmed |
| R3 traceability (✅ weak) | Still weak | Metric table improves oracles; fixture still undefined (G5) |
| R4 contracts defined (✅ with gaps) | Resolved | G1 and G2 closed; remaining nits G9, G12, G14 |
| R5 phases deliverable (✅ weak) | Still open | G4 |
| R6 grounded in codebase (✅) | Still passes | Re-verified incl. new claims (413 mapping, singleton, `DataTable`, exports) |
| BC (no Critical/Warning) | Unchanged | 5 surfaces re-checked |
| G1 response contract inconsistent | Resolved | Interval vs plain share, agreement counts, `settledShareResolved` all explicit |
| G2 `DataTable` empty state | Resolved | Exact rendering with and without `caption`; story for both |
| G3 `core` exports | Resolved | Export list in Architecture matches what `app` needs (`http/index.ts` already re-exports `parse`) |
| G4 phase exit gates | Open | Not added |
| G5 fixture values | Open (partial) | Oracles derivable from the metric table; values still implementer-recorded |
| G6 guard false-positive hint | Open | Nice-to-have |
| G7 pl-PL NBSP pin | Open | Nice-to-have |
| G8 `engineering-standards.md` points at `http/errors.ts` | Withdrawn | The doc already says `core/src/errors.ts` (line 23); the earlier claim was wrong |
| Earlier N04 / English copy | Resolved | D07 adopted, Polish copy and `describeRule`; residual leaks are G9 |
| Earlier R10b scope | Still open | Now Decision 2 and part of the R2 failure |
| Leftover English strings (re-audit) | Partly resolved | Lab strings Polish; shared-code defaults and 413 message remain (G9) |
| Byte-limit oracle (re-audit) | Resolved | Byte refine, 524 288 pass / 524 289 fail, Polish-text CSV case, 1 MiB body cap rationale; wording nit G15 |
| `resolved` ambiguity (re-audit) | Resolved | Defined in the CSV contract: `resolved_on` set, whatever the outcome |
| Duplicate definitions (re-audit) | Open (nice) | G12 |
| `parseJsonBody` no-cap test (re-audit) | Resolved | Phase 2 step 1 tests the no-`maxBytes` path as unchanged, plus 413 with and without `Content-Length` |
| applyRate ownership | Resolved | Portal adds it additively (verified in the portal spec, Architecture and Quote); lab no longer claims it |
| `formatMoney` / ClaimFacts use | Consistent | Portal reuses `formatMoney` and `Money`, defines its own order/quote types (S3), matching Q7; G10 concerns only `ClaimKind` in the agent spec |
| Catalog rows pointing to sibling specs | Mostly consistent | State machine, calendar and `Timeline` rows match; `Wizard`/`StatusTracker` naming and `overdue` drift (G13) |
| CSRF note | Consistent, one handshake gap | G11 |

## 🧪 Audit limits
- Read in full: the spec, the previous audit, `BACKWARD_COMPATIBILITY.md`, `SDLC.md` (no spec-status vocabulary), `AGENTS.md`, `doc/engineering-standards.md` (error file reference only), `.ai/lessons.md`, `.ai/agentic.config.json`, `product-brief.md` (R08-R10, A01, A04, D07, N01-N04), the skill and its references. Sibling specs `2026-10-22-return-agent-decision.md` and `2026-10-22-return-customer-portal.md` were searched for Money/applyRate/formatMoney/ClaimFacts/ClaimKind/CSRF/state machine/calendar/Timeline/Wizard rows and their Status and Phase 1 step 0 lines, not audited end to end. `CODE_REVIEW.md` and `doc/code-review-checklist.md` were applied from the earlier read, not re-read line by line.
- Code checked: `packages/core/src/{http/parse.ts,errors.ts,http/index.ts,http/api-handler.ts,index.ts,register.ts}`, `packages/app/src/server/container.ts`, `packages/app/src/app/**` and `app/public` layout, `packages/ui/src/admin/{tables/data-table.tsx,table.tsx,feedback/*,api/api-call.ts,index.ts}`. No subagents; the surface is small.
- Correction to the earlier audit: it stated `SDLC.md` was absent; the file exists at the repo root (it defines labels and QA gates, no spec status values), so R1's "no ready vocabulary" conclusion stands for a different reason.
- Not run: `npm run audit` (papaparse), typecheck/tests, the tracker (issue #14 and its comment not read), the upstream concept docs (`doc/portal-reklamacje`, docs/02 §2.8) for R10b. `.uxproof/` design contract absent. No spec template exists, so the built-in section set was used.
- No prompt-injection content found in the spec.
