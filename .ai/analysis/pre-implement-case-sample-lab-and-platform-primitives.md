# 🔍 Pre-implementation analysis: Case sample lab (E00-T01) and the platform primitives under it

**Readiness: conditional** — no Critical finding: the spec is confirmed, grounded in the code, and its hand-computed fixture reproduces. Starting now is safe if the "during implementation" items below join the plan (chiefly a named Migration and Backward Compatibility note, a Phase 4 exit gate, and one guard false-positive test).
Spec: `.ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md` · source issue #14 (not read from the tracker) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md`, template built-in (no repo spec template), review checklist `doc/code-review-checklist.md`. Supersedes the earlier same-day report (no-go on R2), whose blocker is now cleared.

## ⚠️ Decisions for the spec owner
- **Status wording (informational).** The Status line reads "Confirmed by the owner in session on 2026-10-23", and the metric definitions and R10b are recorded as accepted. The sibling specs say `Approved`. R1 and R2 pass; using `Approved` would make a later status check mechanical. Recommended: reword. Trade-off: none.
- **Scope cohesion.** The spec bundles a feature (lab) with reusable primitives, but the primitives are what the feature uses, the catalog now lives in `doc/platform-primitives.md`, and Q7 already splits Phase 1 step 1 into its own PR. No split recommended.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Status line records owner confirmation (2026-10-23), including both formerly flagged defaults. |
| R2 | No blocking open questions | ✅ | No Open Questions block and no `⚠` marker remains. The metric definitions and R10b are recorded as accepted in the Status line, the Resolved decisions table and the Metric definitions heading. |
| R3 | Traceability | ✅ | Each metric maps to a table row, a service test and a fixture value. Rules map to the boundary tests. UI acceptance is a recorded manual walkthrough against the same fixture. I re-derived the fixture by hand (counts, medians, p75 = 6.25, Wilson intervals 0.47–0.91, 0.32–0.81, 0.35–0.85, 0.39–0.86, agreement 5/1/1, what-if 8 of 12) and all match. |
| R4 | Contracts defined | ✅ | Route request, response, errors and `fieldErrors` keys are specified. Auth is "none, same as every admin route" and is stated as an accepted risk. The UI names the canonical primitives (`DataTable`, `LoadingMessage`, `ErrorMessage`, `apiCall`) and covers the states. Light/dark is covered by stories. |
| R5 | Phases deliverable | ✅ (one nit) | Phases 1–3 have dependencies and exit gates. Phase 4 has no stated dependency or exit gate (see gaps). |
| R6 | Grounded in the codebase | ✅ | Verified below. |

R6 verification against the code:
- `packages/core/src/http/parse.ts`: `parseJsonBody(request, schema)` has no cap today. An optional `maxBytes` is additive. "Invalid JSON body" is the existing message.
- `packages/core/src/errors.ts` has `AppError`, `ValidationError` and others, with no 413. `core/src/index.ts` already `export *`s `./errors`, so `PayloadTooLargeError` is exported once defined.
- `packages/core/src/register.ts` registers only `returnService` (scoped). `packages/app/src/server/container.ts` has `getRootContainer` memoized on `globalThis`, which calls `getOrm()`, and a `Cradle` interface. A core-only `getCoreContainer()` is therefore needed to keep the lab DB-free, and the spec's wiring matches the real shape.
- `ui` has `api-call.ts` with the `network_error` and `unexpected_response` codes and English fallbacks, and `LoadingMessage` already takes `message`. `EmptyState` requires `message`. `DataTable` returns `EmptyState` before the table (the claimed behavior change is real) and has no `caption`. `ui/src/admin/table.tsx` has no `TableCaption`. `FileImport`, `stats/` and `rules/` do not exist. Stories live in `ui/src/storybook/admin/{forms,tables}/`, matching the rule.
- `core` Vitest includes `src/**/*.test.ts`, so the planned tests and the `__fixtures__` CSV are runnable. `papaparse` is not yet installed. `app/public` exists with no template. `.ai/specs/research/` does not exist yet, so the user creates it when committing the note.
- Brief: R08 (150 zł), R09 (60 zł) and R10 (≥ 2000 zł → manager; transport → priority; electronics/appliances → video) are all `active`. D07 (Polish only) and D09 (one app, `/admin`) are present, and A01, A04 and Q02 exist. N01–N04 are untouched. The R5 "disabled in mockup" note is correct (brief line 91).
- Sibling specs agree with this one: the portal reuses `Money`, `formatMoney` and `multiplyMoney`, adds `addMoney` and `applyRate` itself, and lists the lab route in its CSRF step 0. The agent spec keeps `kind` as the literal `"return"` and has no dependency on this spec. `doc/platform-primitives.md` mirrors the statuses.

## 💥 Backward compatibility
| # | Surface | Phase/step | Change | Severity | Migration path |
|---|---------|------------|--------|----------|----------------|
| 1 | §1 HTTP API | P2.4 | New route `POST /api/discovery/case-sample`; new error code `payload_too_large` (413). Both are additions. | none | None needed. The route falls under the portal's later CSRF 403, which the spec acknowledges. |
| 2 | §3 core exports | P1.1–P1.4, P2.1 | New exports; `parseJsonBody` gains an optional `maxBytes` option. | none | Existing callers are unchanged; test required (the spec has it). |
| 3 | §3 `ui/admin` | P3.1 | `DataTable` gains optional `caption`. Behavior with `caption` and no rows is new; without it, output is unchanged. | Warning (low) | The spec specifies the exact render and checks it via stories of existing callers. Add the admin returns table as an explicit story case (it already does) and name this in the BC note. |
| 4 | §4 config/env | all | No env var or npm script is changed. `papaparse` is a dependency only. | none | None. |
| 5 | §2 DB, §5 process | all | Untouched (no schema; specs and runs follow naming). | none | None. |
| 6 | Spec section | whole spec | There is no named Migration and Backward Compatibility section. The additive claim lives in one paragraph of Risks. | Warning | Add a short section listing rows 1–3 above, since §1 and §3 surfaces are touched. |

## 📝 Spec completeness
| Section | Missing / incomplete | Impact | What to add |
|---------|----------------------|--------|-------------|
| Migration & Backward Compatibility | No named section (the content exists in Risks) | Reviewers checking BC must hunt for it | A 5-line section as in the BC table. |
| Phasing, Phase 4 | No dependency or observable exit gate | A close-out can be declared done unobserved | "Needs Phase 3 merged. Exit: doc links resolve, spec moved, lessons added, comment on #14 posted." |

## 🔍 Repo-rule compliance
| Rule (source) | Spec location | Fix | Severity |
|---------------|---------------|-----|----------|
| `AGENTS.md` / standards §2 rule 4 ("used by one page → colocate") | `FileImport`, `StatTile`, `BreakdownTable`, `RuleSummary` placed in `ui/src/admin/` with a single consumer | Already declared as an owner-approved deviation with a named second consumer each. No action. | Info (declared) |
| Standards §5 (CSRF custom header on state-changing routes) | API Contracts | Covered by the portal spec's step 0 and `apiCall` already sends the header. The spec states the gap until then. | Info |
| Code-review checklist (new routes use `apiHandler`, client via `apiCall`, no Server Actions, services registered explicitly in Awilix) | Architecture | Compliant. `getCoreContainer()` is a second composition path, and it is acknowledged as a risk. | none |

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| The second container (`getCoreContainer`) is untested in `app` (no runner) and could accidentally resolve scoped services | Medium | An unexpected DB dependency or a startup error, found only manually | Declared in the spec, with a manual check with Postgres stopped. Optionally make `registerCore` unit-test that `caseSampleService` resolves from a bare container. |
| Personal-data guard false positives or negatives | Medium | A legitimate upload is blocked, or an identifier slips through (heuristic, declared) | The whitelist is the real control. See the gap on the max-value cell below. |
| Sampling bias ("most recent ~50") makes intervals optimistic | Medium | A reader over-trusts the note | The spec has the caveat sentence in the note and a test for it. |
| `papaparse` and the `npm run audit` gate | Low | The gate could go red on a new advisory | The spec's Phase 1 exit includes audit. |
| Rule vocabulary and `Money` shapes harden once the portal and B-05 persist them | Low | Later rework | Marked provisional; consumers confirm first. |

## 🔍 Gaps
- **Important** — Migration and Backward Compatibility has no named section (see BC row 6). Add it before or alongside implementation.
- **Important** — Phase 4 has no dependency or exit gate (R5 nit). Add one line.
- **Nice-to-have** — The `cellGuard` phone rule strips dots, so the legal maximum `value_pln` `1000000.00` becomes the 9 digits `100000000` and would be refused as personal data. Add a unit test and either apply the pattern only to cells that are digits and separators with no decimal comma or dot, or accept the boundary and document it.
- **Nice-to-have** — The "Spec adds `PayloadTooLargeError` to `core/src/index.ts`" wording is redundant because `export * from "./errors"` exists. Drop it from the export list.
- **Nice-to-have** — `.ai/specs/research/` does not exist. Mention that the user creates it when committing the note.

## 📋 Remediation plan
1. **Before implementation** — none mandatory. Optionally reword the Status to `Approved`.
2. **During implementation (add to the plan)**
   - Add the Migration and Backward Compatibility section (BC rows 1–3) to the spec, or at least to the PR body.
   - Add the Phase 4 dependency and exit gate.
   - Add the `1000000.00` guard test in Phase 1 step 4 (`parseTable`).
   - Ship Phase 1 step 1 as its own early PR, since the portal PR A waits on it.
3. **After implementation (follow-up)** — a unit-level check for the core-only container if an `app` runner ever appears. Re-confirm the vocabulary when B-05 is specified.

## 🧪 Audit limits
- Read in full: the spec; `BACKWARD_COMPATIBILITY.md`; `doc/code-review-checklist.md`; `doc/platform-primitives.md`; `AGENTS.md`/`CLAUDE.md`; the product brief (rules, non-goals, decisions, assumptions). Skimmed: `doc/engineering-standards.md` (sections 1–7), `.ai/lessons.md`, and the portal and agent specs (only the lines that mention this spec).
- Code searched: `packages/core/src` (http, errors, register, index, vitest config), `packages/app/src/server/container.ts`, the admin returns page and route, `packages/ui/src/admin` and `ui/src/storybook`, `next.config.ts`. I did not open the Next.js docs beyond confirming `force-dynamic` is already used by the existing admin page on Next 16.4.1.
- The fixture was recomputed with a throwaway Node snippet (no files written); no tests or builds were run.
- Not checked: the tracker (issue #14 and its comment of 2026-10-22), the docs/ concept source (not in the repo), `.uxproof/` (absent), and the mockup source cited by the brief.
- No suspected prompt injection found.
