# Execution plan: read-only rules page and threshold simulation (E04-S03, #110)

Source doc: .ai/specs/2026-11-08-rules-engine-recommendations.md
Issue: #110 (Closes), epic #31 (Refs), spec PR #111 (Refs). Phase 3 only.

## Goal
A manager (`MANAGE_RULES`) opens `/admin/rules`, sees the active rules (`describeRule`) and tries other R08/R09 thresholds against the current requests (`withThresholds` + `simulate`). Read-only: nothing persisted, no editing.

## Scope
- `core`: Zod schema `rulesSimulateSchema`, `RulesService.listRules` / `simulateRules` (facts from stored requests: kind + resolution amount, as `recommend()` does; requests without an amount are counted as skipped), tests.
- `app`: `GET /api/rules`, `POST /api/rules/simulate` via `apiHandler`, `requireAgent`, `permission: "MANAGE_RULES"`, entries in `ROUTE_PERMISSIONS`; DI registration.
- `app`/`ui`: `/admin/rules` Server Component page (rules read on the server), client what-if form using `apiCall`, Polish copy, story, nav link.

## Non-goals
Editing/enabling rules, settings storage, rule builder (B-05), Phase 1/2 code, moving the spec to `implemented/`.

## Risks
Public API surface (additive). Simulation reads all requests via `ReturnRepository.list()`; capped at 5000 rows and reported as `truncated`. Thresholds limited to tunable rules R08/R09, max 1 000 000 zł.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 3: Rules page

- [x] 3.1 core: schemas and RulesService (listRules, simulateRules) with tests
- [x] 3.2 app: GET /api/rules and POST /api/rules/simulate, DI, route tests
- [x] 3.3 app/ui: /admin/rules page, what-if form, Polish copy, story, nav, docs

## Outcome

- Phase 3 only (read-only `/admin/rules`, `GET /api/rules`, `POST /api/rules/simulate`). Spec stays in `.ai/specs/` (Phases 1/2 remain on their PRs).
- Design choice: the what-if evaluates the stored requests (kind + resolution amount, same facts as `recommend()`), capped at 5000; nothing persisted. No new ui component (`RuleSummary` and its story are reused; the what-if form is colocated in `app`).
- Also added `/api/rules/**` to the proxy's protected paths (`isAgentProtectedPath`) with tests.
