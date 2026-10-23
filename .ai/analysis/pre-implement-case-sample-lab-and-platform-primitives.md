# 🔍 Pre-implementation analysis: Case sample lab (E00-T01) and the platform primitives under it

**Readiness: go** — no Critical finding and no Warning remains: the spec is `Approved`, grounded in the real code, its hand-computed fixture still reproduces, and all five conditions from the previous (conditional) audit are resolved. One new Nice-to-have (a wording contradiction in the phone guard) does not block.
Spec: `.ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md` · source issue #14 (not read from the tracker) · audited 2026-10-23 (re-audit of the committed revision d9c37ff, working tree clean) against `BACKWARD_COMPATIBILITY.md`, template built-in (no repo spec template), review checklist `doc/code-review-checklist.md`. Replaces the earlier same-day conditional report.

## ✅ Previous conditions: status
| # | Earlier condition | Now | Evidence |
|---|-------------------|-----|----------|
| 1 | Named Migration and Backward Compatibility section (BC row 6, Important gap) | Resolved | New section "Migration & Backward Compatibility" lists §1 HTTP API (route, `payload_too_large` 413), §3 `core` (new exports, optional `maxBytes`, test for unchanged callers), §3 `ui/admin` (`DataTable` caption, exact render, stories of an existing caller), §4 and §2/§5 as untouched. Matches `BACKWARD_COMPATIBILITY.md` surfaces 1–5. |
| 2 | Phase 4 dependency and exit gate (R5 nit) | Resolved | Phasing: "Needs Phase 3 merged ... Exit: `doc/platform-primitives.md` rows final and linked, the issue #14 comment posted, and the spec in `.ai/specs/implemented/`." Each is observable. |
| 3 | Guard boundary for `value_pln` `1000000.00` (Nice-to-have) | Resolved, with one wording nit (see N1) | Data Model: the phone pattern applies only to cells with no decimal point or comma and exactly 9 digits after stripping. Phase 1 step 4 adds tests for `1000000.00` and `1000000,00` (accepted, not flagged). Even without the rule, the max `value_pln` has 7 integer digits plus decimals, so the boundary is now deliberate. |
| 4 | Redundant `PayloadTooLargeError` in the export list | Resolved | Removed from the Architecture export list. The BC table correctly notes it is exported via `export * from "./errors"` (`packages/core/src/index.ts`, verified earlier). |
| 5 | `.ai/specs/research/` does not exist | Resolved | UI/UX step 5 now says the user creates the folder when committing the first note. Folder still absent in the repo, so the statement is true. |
| 6 | Status wording (informational) | Resolved | Status now begins "Approved: confirmed by the owner in session on 2026-10-23", matching the sibling specs. |

## ⚠️ Decisions for the spec owner
None open. Scope cohesion was reconsidered: the primitives are exactly what the lab uses, Q7 splits Phase 1 step 1 into its own PR, and the catalog lives in `doc/platform-primitives.md`. No split recommended.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | `Approved`, with owner confirmation date. |
| R2 | No blocking open questions | ✅ | No Open Questions block and no `⚠ NEEDS HUMAN CONFIRMATION` marker. Metric definitions and R10b recorded as accepted. |
| R3 | Traceability | ✅ | Each metric maps to a definitions row, a service test and a fixture value. Fixture re-derived in the earlier audit and unchanged in this revision (the diff since the last audit touches only the Status line, export list, guard sentence, research-folder note, BC section, Phase 4 text and one test line). |
| R4 | Contracts defined | ✅ | Route request/response/errors, `fieldErrors` keys, 413 cap, CSRF position, UI primitives with props, states, accessibility, Polish copy plan (D07). |
| R5 | Phases deliverable | ✅ | Phases 1–4 all declare dependencies and observable exit gates. |
| R6 | Grounded in the codebase | ✅ | Re-checked this run: `apiHandler` maps any `AppError` to its own `status`/`code` and envelope (so a new 413 subclass is purely additive); `core/src` has `errors.ts`, `http/{api-handler,parse,...}`, `register.ts`; `ui/src/admin/api/api-call.ts` already sends `x-requested-with`. Earlier verification (container shape, `DataTable`, `TableCaption` absent, Vitest include, brief rules R08–R10 and D07/D09) is unchanged by the diff. |

## 💥 Backward compatibility
Every `BACKWARD_COMPATIBILITY.md` surface (§1–§5) checked against every phase. No Critical, no Warning.
| # | Surface | Phase/step | Change | Severity | Migration path |
|---|---------|------------|--------|----------|----------------|
| 1 | §1 HTTP API | P2.4 | New route, new error code 413 | none (additive) | Named in the spec's section. Falls under the portal's later CSRF 403 (portal Phase 1 step 0 lists `/api/discovery/case-sample` explicitly, verified). |
| 2 | §3 core exports | P1, P2.1 | New exports; optional `maxBytes` on `parseJsonBody` | none | Test for unchanged callers is specified. |
| 3 | §3 `ui/admin` | P3.1 | `DataTable` optional `caption` | none (previously low Warning, now has the named note, exact render and caller story) | Covered by stories plus typecheck. |
| 4 | §4 config | all | None; `papaparse` dependency only | none | None. |
| 5 | §2 DB, §5 process | all | Untouched | none | None. |

## 🔍 Repo-rule compliance
No violations. The component-placement deviation (standards §2 rule 4) is declared and owner-approved with a named second consumer each; CSRF position (standards §5) is consistent with the portal spec; routes use `apiHandler` and `apiCall`, no Server Actions, service registered explicitly in Awilix. `getCoreContainer()` is a declared second composition path in `app`.

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| Second container could resolve a scoped service by accident (no `app` test runner) | Medium | Hidden DB dependency | Declared; manual check with Postgres stopped in Phase 2 step 4 |
| Personal-data guard is heuristic (false positives and negatives) | Medium | Blocked legitimate upload or a missed identifier | Column whitelist is the real control; boundary test added |
| "Most recent ~50" sampling makes intervals optimistic | Medium | Over-trust of the note | Caveat sentence in the note, with a test |
| `papaparse` and the audit gate | Low | Red gate on a new advisory | Phase 1 exit includes `audit` |
| Rule vocabulary and `Money` harden when portal/B-05 persist them | Low | Later rework | Marked provisional |

## 🔍 Gaps
- **Nice-to-have (N1, new)** — Data Model guard sentence contradicts itself: the phone pattern strips "dots" as separators, but then applies only to cells that contain no decimal point or comma. A dot- or comma-separated phone (`600.123.456`, `600,123,456`) therefore bypasses the phone check (the e-mail check and the whitelist still apply). Either drop "dots" from the stripped set and accept the gap as documented, or keep stripping and exempt only cells that parse as a plain decimal (`^\d+[.,]\d{1,2}$`). Add one test line either way. Not blocking: the guard is declared a backstop.
- **Nice-to-have (carried)** — Optional: a `registerCore` unit test that `caseSampleService` resolves from a bare container, to reduce the second-container risk.

## 📋 Remediation plan
1. **Before implementation** — none required. Optionally fix N1 wording.
2. **During implementation (add to the plan)** — resolve N1 in Phase 1 step 4 when writing the `cellGuard` tests; ship Phase 1 step 1 as its own early PR (already in the spec, Q7).
3. **After implementation (follow-up)** — re-confirm the rule vocabulary when B-05 is specified; core-only container check if an `app` runner appears.

## 🧪 Audit limits
- Read in full: the spec, `BACKWARD_COMPATIBILITY.md`, the previous report, the skill references. Verified against code: `packages/core/src/http/api-handler.ts`, `core/src` layout, `ui/src/admin/api/api-call.ts`; grepped the portal spec for the CSRF step and the lab route. Other code surfaces (container, `DataTable`, vitest config, brief rule ids, `doc/platform-primitives.md`) were verified in the earlier audit, and the diff since then (`git diff HEAD~1`) touches none of the claims about them.
- Fixture was not recomputed again, because the fixture section is unchanged since the last audit, which re-derived it. No tests or builds were run.
- Not checked: the tracker (issue #14 and its comment), `.uxproof/` (absent), the mockup source.
- No suspected prompt injection found.
