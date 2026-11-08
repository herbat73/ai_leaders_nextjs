# Rules engine in the live flow: recommendations and shadow measurement (R08–R10)

(Renamed from `...-auto-acceptance`: nothing is accepted automatically, see Q3.)

Status: DRAFT for owner review — not approved, no code. Epic: #31 (E04). Design authority: `.ai/specs/product-brief.md`.
Owner answers of 2026-11-08: Q1 override D15 for this slice; Q2 one spec in phases; Q3 recommendation only (agent
confirms); Q4–Q9 recommended defaults accepted (see Resolved decisions).

## 📝 TLDR
Agents decide every return and complaint by hand (current behavior). The rules engine (`packages/core/src/rules`) is
built but used only by the read-only lab. Proposed (future behavior): on the agent's case page and in the inbox, show
what R08/R09/R10 recommend ("Rekomendacja: zaakceptuj — R08"), let the agent apply it with the normal decision action,
and record on each decision whether the agent followed the recommendation. Nothing is decided automatically and the
customer sees no change. The recorded agreement rate is the first real evidence for A04 (settled-by-rule share and
false-acceptance rate) while D15's concern — building without data — is contained by the recommend-only design.

## 📝 Problem Statement
A04 (≥ 20% of cases settleable by simple rules, D16) rests on one undocumented sample: 24% (14–37%), n = 50, of 12
rule-settled cases 8 matched the real outcome, 1 was a false acceptance, 3 other (Q21 open). Cost of manual handling is
unmeasured (A01). A fully automatic R08 would act on that thin evidence. Recommend-only plus a recorded
recommended-vs-actual comparison turns real traffic into the missing data at no customer-facing risk.

## 📝 Proposed Solution
Compute a **recommendation** from `BRIEF_RULES` with `evaluate` on the live case, expose it in the case detail view,
show it on the decision card and as an inbox badge, and write a **comparison event** when an agent decides.
Alternatives rejected: (1) fully automatic approval/mail (Q3 = b; one false acceptance in 12, R11/R15 untouched);
(2) a new rules table + editor first (nothing to edit yet; thresholds are D16 constants); (3) batch recomputation job
(stateless on-read is simpler and always current).

## 📝 Architecture
- `core`: new pure function `recommend(request, items, categories, rules)` in
  `services/returns/recommendation.ts`: builds `ClaimFacts` (kind, value, categories), calls `evaluate`, folds the
  matches into a view `{ approve: ruleId|null, keepItem: ruleId|null, highPriority: bool, assignManager: bool,
  appliedRules: string[] }`. `ReturnService.getDetail` / `listInbox` attach it; `transition` appends the comparison
  event. Rules come from `BRIEF_RULES` through an injected `rules` dependency (Awilix), so a later settings/DB source
  needs no service change.
- `db`: no schema change in Phases 1–2 if events accept a new type with JSON payload (to verify in Phase 1 step 1);
  otherwise one additive migration.
- `app`: `GET /api/returns[...]` responses gain a `recommendation` field (consumers: the admin Server Components and
  any client list refresh via `apiCall`); only attached when the flag is on. `ui`: reuse `RuleSummary` (built) for "applied rules".
- Existing/new: engine, `ClaimFacts`, `Money`, events, approval limit R11 — existing and unchanged; recommendation
  function, view field, comparison event — new.
- Product category: `ClaimFacts.categories` needs a source. The order port line must carry a category; verify in
  Phase 1 step 1 (if absent, categories are `[]` and R10b never matches; R10b is out of scope anyway, Q7).

## 📝 Data Model
No new entity. One new event type on the existing return timeline: `return.rules.compared`
`{ recommended: "approve"|"keep_item"|"none", ruleIds: string[], actual: <target status>, followed: boolean }`,
actor = the deciding agent. Contains no customer data beyond what the event already references. Phase 3 adds nothing.

## 📝 API Contracts
- Additive field `recommendation` on the existing agent return list/detail payloads (`BACKWARD_COMPATIBILITY.md`:
  additive JSON field, no breaking change; customer-facing payloads do NOT get it).
- Phase 3: `GET /api/rules` (agent session; read-only list of `BRIEF_RULES` with `describeRule` text) and
  `POST /api/rules/simulate` reusing `simulate`/`withThresholds` (Zod schema in `core`, `apiCall` from the UI,
  `apiHandler`, permission `MANAGE_RULES`). Per `.claude/rules/api.md`.

## 📝 UI/UX
Decision card: a box "Rekomendacja reguł" with the rule name (`RuleSummary`), a plain statement ("Zwrot do 150 zł —
zalecana akceptacja") and no button of its own: the agent uses the existing approve/reject actions. States: no match
("Brak rekomendacji"), recommendation present, engine error (box hidden, logged; never blocks a decision). Inbox: small
badges "Zalecana akceptacja" and "Wysoki priorytet" (R10a), "Kierownik" (R10c); filter and sort unchanged. R10c is a
hint only; the real gate stays R11 (`requiresManagerApproval`). Accessibility: badges carry text, not colour alone. All
copy Polish (D07). Phase 3: read-only `/admin/rules` page (list + simulate against thresholds), no editing.

## 📝 Edge Cases & Failure Scenarios
- Rule says approve but the case is ineligible (past window R01/R02, `returnable=false` R06): eligibility already
  rejected such submits, so they never exist; recommendation is computed only for cases in `submitted`/open states.
- Agent rejects against a recommendation: allowed, `followed=false`, no extra reason beyond R15.
- Case value changes: value is immutable after submit (see `approval.ts` note); a future edit feature must recompute.
- Multi-line cases: value = total resolution amount (`resolutionAmount`); exchange (no amount) → no value rule matches
  (fails closed to "none").
- Unknown/legacy status: no recommendation, never a workable default.
- Comparison event write fails: the decision itself must not fail; log and continue (event is best-effort telemetry,
  appended in the same transaction only if the repository already does so for decision events — verify).
- False acceptance (1/12 in the sample): mitigated because a human confirms; the comparison events let us count
  disagreement per rule before any future automation.

## 📝 Risks & Impact Review
- Supersedes **D15** and the **Q20** "stays in Later" outcome for this slice only — owner approval given 2026-11-08
  (record a decision D17 in the brief and a decision file under `research/decisions/`). R08's deferral note in the
  brief ("not built, every return goes to an agent") stays true: nothing is auto-approved.
- Anchoring risk: agents may rubber-stamp recommendations; the `followed` metric will show a rate near 100%, which is
  ambiguous. Mitigation: report disagreements and the false-acceptance count, not only agreement.
- Q12 thresholds from the mockup (≥ 500 zł → repair, ≥ 6 reports → abuse signal) stay OUT (Q12 answered: later,
  configurable). Thresholds 150/60 zł are unchanged constants (D16).
- Reversible: remove the view field and the event; no data migration, no customer impact.

## 📝 Decisions in play
Relies on: R08, R09, R10, R11 (unchanged), R15, D07, D16, Q12 (answered), N01–N04 untouched. Proposes to supersede
(owner-approved 2026-11-08): D15 for this slice; Q20's "stays in Later". New: D17 (record in brief when the spec merges).

## Resolved decisions (owner, 2026-11-08)
| Id | Decision |
|---|---|
| Q1 | Override D15 for this slice |
| Q2 | One spec, three phases (below) |
| Q3 | Recommendation only; the agent confirms. No automatic transition, no customer mail |
| Q4 | R09 `keep_item` is a recommendation too; supplier claims (UC-12) unchanged, agent decides |
| Q5 | Thresholds stay constants (D16); settings primitive deferred |
| Q6 | No extra guards; Q12 mockup thresholds out; human confirmation is the guard; comparison events measure it |
| Q7 | R10a (priority badge) and R10c (manager hint) in; R10b video deferred with R07 and uploads |
| Q8 | Config flag `EASYRMS_RULES_RECOMMENDATIONS` (`on`/`off`, default `off`); shadow comparison events written only when `on` |
| Q9 | Audit = timeline event with deciding agent and rule ids; no extra finance/legal fields |

## 📋 Phasing
1. **Recommendation + comparison** (P1): core function, DI, view field, decision-card box, comparison event, flag.
2. **Inbox signals** (P2): badges for R10a/R10c, inbox payload field. Needs P1 merged (uses `recommend()` and the flag); shippable separately from P3.
3. **Read-only rules page + simulate** (P3, optional): `/admin/rules`, API `GET /api/rules`, `POST /api/rules/simulate`.
   A separate capability (adds public API surface, reuses `MANAGE_RULES`); needs only the engine and does not depend on
   P1/P2 or the flag. Kept in this spec per the owner's Q2 answer, but it is independently approvable: it may be
   dropped or moved to its own spec at approval without touching P1/P2.
   **Flag gating:** `EASYRMS_RECOMMENDATIONS` off means the `recommendation` field is absent from payloads
   (attached only in `ReturnService`, P1 step 3 and P2 step 1), so the decision-card box and the inbox badges render
   nothing; acceptance tests cover flag-off payload and UI.

## 📋 Implementation Plan
**Phase 1 — Recommendation and comparison**
1. Verify before approval of this phase: event types/payload support, category source on order lines, how `transition`
   writes events (same transaction or not). Output: findings recorded in this spec. If a migration is needed, add a
   conditional step 1b: additive migration in `packages/db` + `npm run test:db` migration test, result in `.ai/runs/`.
2. `core`: `recommend()` + types + Zod view schema; unit tests for R08, R09, no-match, exchange (no amount), boundary 150,00/150,01 zł and 60,00/60,01 zł.
3a. `core`: `parseRulesRecommendationsFlag` (core never reads env); unit tests (on/off/invalid → config error).
3b. `core`: register `rules` dependency in Awilix; `ReturnService.getDetail` attaches the recommendation only when the flag is on; service tests incl. flag-off.
4. `core`: `transition` appends `return.rules.compared` (decision made in step 1: same transaction as the transition if the repository supports it, else best-effort after commit); tests for followed/not followed and write failure not failing the decision.
5. `app`: payload field + decision-card box (copy in Polish, states per UI/UX); README env table row; component/story where the project requires it.
6. Docs in the same PR: `doc/platform-primitives.md`, README flag row, brief (D17 and the A04 note), decision file under `.ai/specs/research/decisions/`. Gate + run log; QA evidence under `doc/previdences/pr-<n>/`.

**Phase 2 — Inbox signals**
1. `core`: `listInbox` attaches `highPriority`/`assignManager` (flag-gated, uses P1's `recommend()`); tests. Depends on P1 merged.
2. `app`/`ui`: badges with text, a11y check, story; inbox query pushdown untouched (badges computed from fetched page only).

**Phase 3 — Rules page**
1. `core`: Zod schemas + service `listRules`, `simulateRules` (wraps `simulate`/`withThresholds`); tests.
2. `app`: API routes (`apiHandler`, CSRF, `MANAGE_RULES`), per `.claude/rules/api.md`.
3. `app`/`ui`: `/admin/rules` read-only list + threshold what-if; no persistence.

On the last phase's merge: spec moved to `implemented/`.
