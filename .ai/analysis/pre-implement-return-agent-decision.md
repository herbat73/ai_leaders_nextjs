# 🔍 Pre-implementation analysis: Return agent decision: status model, timeline, inbox and decision card

**Readiness: conditional** — No Critical finding: the spec is Approved, grounded in the code, and its BC story is complete. Six Important gaps (the service's pre-read, the `list` port signature, the db test script name, RMA backfill/sequence mechanics, the P8 request id, the DB-suite harness) would make implementation guess, or would break the `npm test` gate, unless they go into the plan.
Spec: `.ai/specs/2026-10-22-return-agent-decision.md` (Status: Approved; P1–P8 confirmed in session 2026-10-23) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md` (all 5 surfaces), template: built-in section set (no `paths.specTemplate`, no template file), review rules `doc/code-review-checklist.md` + `CODE_REVIEW.md`, `doc/engineering-standards.md`, `.ai/specs/product-brief.md`. This is a re-audit after the P5–P8 revision; it supersedes the earlier report at this path.

## ⚠️ Decisions for the spec owner
- **Scope cohesion.** One PR carries the status model, a new DB test runner (P5), a shared-layer change (`apiHandler` 500 logging, P8, which affects every route) and two UI primitives. Each would work without the others. Recommended: keep as one change set, since the owner confirmed P5/P8 as part of it and Phase 1 is already staged (step 1 additive, step 2 cut-over). If review size becomes a problem, ship the `apiHandler` logging change as its own PR first (it is step 1 and independent). Tradeoff: one more PR versus a smaller blast radius on the shared layer.
- **Accepted deviations (no action):** single-migration status rewrite instead of expand/migrate/contract, forward-only `down` (BC §2 asks for a working `down`; spec P2 documents the refusal), DB suite outside the CI gate. All are stated and owner-confirmed.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Line 3 `Status: Approved`, with P1–P8 confirmations dated 2026-10-23. |
| R2 | No blocking open questions | ✅ | No Open Questions block and no `⚠ NEEDS HUMAN CONFIRMATION`. P4's own heading sentence ("P1, P2, P3 and P4 below") is consistent with the table. |
| R3 | Traceability / oracles | ✅ | Every rule has a named oracle: RMA format and year boundary (core tests plus the P5 backfill-equals-`formatRma` test), due marker table, P6 (400 for a note on another status, note not cleared), P8 (log test), concurrency (db suite plus scripted run), `down` refusal. Phase 2 UI rests on manual acceptance, stated and justified (no UI runner). |
| R4 | Contracts defined | ✅ (gaps G-1, G-2, G-5) | GET/PATCH/POST shapes, 400/404/409 rules, port return types, `ReturnListItem`/`ReturnDetail`, UI primitives and states are given. Missing: which port method the service pre-reads (G-1), the `list` port signature (G-2), the request-id source (G-5). |
| R5 | Phases deliverable | ✅ | Phase 1 dependencies and exit gate (recorded Postgres run, `test:db`) and Phase 2 dependencies are stated; step 1 additive and green alone, step 2 one commit ending on the full gate. |
| R6 | Grounded in the codebase | ✅ | Verified below; one small mis-statement (BC row 5 "gains `list`", G-2). |

**Grounding (R6), checked against the code:**
- `packages/core/src/errors.ts`: `AppError` takes `fieldErrors` as its 4th constructor argument; `ValidationError` passes `fields`; `ConflictError(message)` has no `fields`. The additive optional argument works end to end through `apiHandler`, which already serialises `fieldErrors`. No 422 class exists, as the spec says.
- `apiHandler` logs `logger.error("Unhandled API error", { error })` verbatim on the 500 path, as stated. `ApiLogger` is exported from `core/src/http/types.ts` through `http/index.ts`.
- `makeCrudRoute`: `list` is `apiHandler(async () => list(...))` and never receives the `Request`; `patch` handler is `(service, id, input)`, with the id parsed as a positive integer. A hand-written `GET` beside `export const { POST }` is valid because only configured verbs are returned. Standards §2 and §7.5 allow `apiHandler` for workflow routes.
- `return.service.ts` / `types.ts`: `updateStatus` and `findById` exist and leave the port; `RETURN_STATUSES` has the five old values; `ReturnRequest` has none of `rma`, `kind`, `hasDecisionNote`. The repository's `toDomain` falls back to `"requested"` for unknown values (the corrupt-row behaviour the spec replaces). `Cradle` holds only `returnService`; `registerCore` registers only `returnService`; no `clock` or `logger` exists, as assumed.
- `db`: one migration (`Migration20261013164552`) with no `down`; `.snapshot-easyrms.json` and `entities/index.ts` (`entities = [ReturnRequestSchema]`) exist; `created_at` is `timestamptz`, so `at time zone 'Europe/Warsaw'` is correct. Migrator config has `transactional: true`. `@easyrms/db` has no `test` script and no Vitest dependency; `@easyrms/core` has `vitest run`.
- MikroORM 7.2.5: `em.nativeUpdate` returns `Promise<number>` (affected rows); `TransactionPropagation.REQUIRED` exists; `DriverException` copies the driver error's own properties (so `code` and `constraint` are present on wrapped pg errors) and its message embeds the driver message, which supports the P8 reasoning.
- Admin: `admin/returns/page.tsx` and `return-status-actions.tsx` use `RETURN_STATUSES`/`ReturnStatus` and `Record<ReturnStatus, …>` as the spec's consumer list says; `api/returns/[id]/route.ts` calls `service.updateStatus`; `Textarea` and `Timeline` do not exist in `ui/src/admin/`.
- Product brief: R13, R15 (reject reason ≥ 30, active), D06 (active), D07 (Polish-only, 2026-10-23), Q04, Q10, Q13 are as the spec cites them. R14 and D04/D05 are `superseded` (replaced by R17, D09, D08), and the spec does not rely on them. No contradiction of an active entry.
- Root `package.json`: `"test": "npm run test --workspaces --if-present"`; `test:db` does not exist yet. `.ai/scripts/` and `.ai/runs/` exist.

## 💥 Backward compatibility
All five `BACKWARD_COMPATIBILITY.md` surfaces audited against every phase and step. The spec's own section (7 rows) is complete and correct; no Critical and no Warning remains.

| # | Surface | Phase/step | Change | Severity | Migration path |
|---|---------|------------|--------|----------|----------------|
| 1 | §1 HTTP API | P1 step 2 | `status` value set replaced; PATCH enforces state machine and note rule; new error paths | breaking, compliant | Consumers updated in the same PR; PR "Breaking changes" heading; no dual-run (pre-1.0, private). Spec names the required path. |
| 2 | §2 Database | P1 step 2 | New columns/table/sequence, in-place status rewrite, first `down` | breaking, compliant (accepted deviation) | New migration, not editing the merged one, snapshot updated, rollback note in PR (forward-only after first use, P2). |
| 3 | §3 Internal APIs | P1 steps 1–2 | `RETURN_STATUSES`, `ReturnRequest`, `ReturnRepository`, `ReturnService`, `ConflictError`, `apiHandler` 500 log, `returnStatusUpdateSchema` | breaking, compliant | In-repo consumers listed and updated in the same PR; `apiHandler` and `ConflictError` changes are additive. Wording fix in G-2 (BC row 5 says the port "gains `list`", which already exists). |
| 4 | §4 Config / scripts | P1 step 2 | New root script `test:db` | additive | Add to README (the spec does); G-3 says what name the db script must have. |
| 5 | §5 Process | P2 step 4 | Spec moved to `implemented/`, run logs named `YYYY-MM-DD-slug.md` | compliant | None. |

## 📝 Spec completeness
All built-in sections present (TLDR, Problem, Solution, Architecture, Data Model, API, UI/UX, Edge Cases, Risks, Migration & BC, Phasing, Implementation Plan). Test coverage is embedded in the plan steps rather than a section; acceptable here because each changed API/UI path has a named test or manual acceptance.

| Section | Missing / incomplete | Impact | What to add |
|---------|----------------------|--------|-------------|
| UI/UX | Next.js 16 `params`/`searchParams` are Promises; no mention; invalid `?status=` or non-numeric `[id]` on the pages not specified | Pages built from memory of the old API; 400 JSON vs page behaviour left to guesswork | Cite `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`; say an invalid `?status=` on the page shows the unfiltered list (or an error message) and a non-numeric id calls `notFound()` (G-7). |

## 🔍 Repo-rule compliance
| Rule (source) | Spec location | Fix | Severity |
|---------------|---------------|-----|----------|
| AGENTS.md: "db → core (for shared types only)" | Step 2: repository imports `formatRma` and `toReturnStatus` (functions) from `core` | Existing precedent: `return.repository.ts` already imports `isReturnStatus` at runtime and lint does not forbid it. State the interpretation in the spec (shared status/format helpers count as shared domain logic) or keep the mapping inputs as types plus a `db`-local check. P7 correctly keeps the migration free of `core`. | Nice-to-have |
| `doc/engineering-standards.md` §5 "MikroORM APIs only" | `nextval('return_rma_seq')`, migration SQL | Already addressed by P4 (parameterised, in `db`; `em.execute` is a MikroORM API). Compliant. | none |
| Checklist: concurrent-case test | `transition` compare-and-set | Now covered by the P5 db suite (two concurrent calls) in addition to the scripted run. Compliant. | none |

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| DB suite outside CI (P5) | Medium | A migration or compare-and-set regression passes the gate | Spec already records `npm run test:db` per PR in `.ai/runs/` and the scripted run as the merge gate. Keep both. |
| Wrong `test` script name in `@easyrms/db` | Medium | Root `npm test` (`--workspaces --if-present`) would pick up a db `test` script and fail anywhere without Postgres, silently turning the "outside the gate" decision into a red gate | G-3. |
| `migration:create` drift (`return_rma_seq`, hand-edited snapshot, events entity) | Medium | Next developer's generated migration drops or recreates the sequence or events table | Add an acceptance check: after step 2, `db:migration:create` on an up-to-date DB produces no diff (the CLI reports nothing to do). Generate the snapshot from the CLI against the migrated DB rather than hand-writing JSON. |
| `apiHandler` logging change touches every route | Low | A mistake blinds all 500 diagnostics | Step 1 tests (value-free, `code`/`constraint` kept); fixture must be a MikroORM-shaped error (G-5). |
| No agent auth (AD-A2), hard-to-reverse status names and RMA format | Low (accepted) | Product-level, named in the spec | Already recorded as a blocker in Phase 2 step 4 and README. |

## 🔍 Gaps
- **Important**
  - **G-1 Service pre-read.** `findById` leaves the port and `findDetail` is "the only read that includes the note", yet `ReturnService.transition` must read the current status before calling `transition(id, from, to, note)`. Name the method: either a status-only `findStatus(id)`/`ReturnRequest` read on the port, or explicitly use `findDetail` and say it must not leak the note into errors or logs. Also decide the `not_found` path when the pre-read is null (404 before any write).
  - **G-2 `list` port signature.** `ReturnRepository.list()` already exists; BC row 5 says it "gains `list`". Specify the new signature (`list(filter?: { status?: ReturnStatus | "unknown" })`) and how `unknown` is queried (status not in the nine values), and fix the BC row wording. The fake in `return.service.test.ts` must implement the same.
  - **G-3 DB test script wiring.** Name the package script so the root `npm test` does not run it: e.g. `@easyrms/db` script `test:db` and root `"test:db": "npm run test:db -w @easyrms/db"`. Add `vitest` to `@easyrms/db` devDependencies (`npm install -D vitest -w @easyrms/db`), a `vitest.config` (`include: src/**/*.test.ts`, `fileParallelism: false` or one schema per file), and make the tests fail loudly with a clear message when Postgres is unreachable instead of hanging. `npm run audit` and `typecheck` must stay green with the new dependency.
  - **G-4 RMA backfill mechanics.** The Data Model says the number comes "from the sequence" and the Architecture says a TypeScript loop formats it, while the year comes from `extract(year … 'Europe/Warsaw')` in SQL. State precisely: select rows ordered by `created_at, id` with the year computed in SQL, call `nextval('return_rma_seq')` per row (or assign ordinals and then `setval('return_rma_seq', n)`), and assert the sequence continues after the last backfilled value so the first new RMA cannot collide with the unique index. Add that as a P5 test (create after migration gets backfilled count + 1).
  - **G-5 P8 request id and route.** No request id exists anywhere in `core`/`app` today. Say where it comes from (generate with `crypto.randomUUID()` in `apiHandler` unless an `x-request-id` header is present, and return nothing to the client), and that "route" is `new URL(request.url).pathname` without the query string (the `?status=` and any future token must not be logged). The test fixture should be a `DriverException`-shaped error (own `code`/`constraint`, message containing the note), since MikroORM copies the pg error's own properties onto it.
  - **G-6 DB suite harness.** Specify how tests start from the pre-migration state on a throwaway schema: create the schema, run only `Migration20261013164552`, seed legacy rows (including `requested`, `refunded`, two rows with equal `created_at`, one dated 31 Dec 23:30 UTC, one corrupt status), then run the new migration. Say how `return_rma_seq` and unqualified table names resolve in that schema (Migrator `schema` option or `search_path`), and that concurrency tests use two separate forks/connections (pool minimum is 2 by default).
- **Nice-to-have**
  - **G-7 Next.js specifics.** See completeness table; also `notFound()` for non-numeric ids, and that the card's Server Component reads `getDetail` directly through the request scope (no fetch).
  - **G-8 PATCH ordering and storage.** State that schema validation (400, including P6 and the 30-character rule) runs before the state-machine check (409), and whether the stored note is the trimmed value (recommended: trimmed, so the 30-character count and the stored text agree).
  - **G-9 `fieldErrors.status` semantics.** On 409 it carries a status value, elsewhere `fieldErrors` carry messages. Note in the spec that clients must treat it as data for the refresh, not display text (the card shows its own Polish message).
  - **G-10** Migration `down` guard is stated twice (rows in four statuses, and any non-`submitted` events). The event check alone suffices because every move writes an event; keep the status check as a belt-and-braces test or drop it.

## 📋 Remediation plan
1. **Before implementation** — none mandatory (no Critical). Optionally fold G-1 to G-6 into the spec so the author and the implementer agree on names.
2. **During implementation (add to the plan)** — G-1 (name the pre-read method), G-2 (`list` signature, fix BC row 5 wording), G-3 (db script `test:db`, vitest dependency and config, audit/typecheck green), G-4 (sequence continuity and one backfill approach, plus a test), G-5 (request id and pathname-only route, MikroORM-shaped test fixture), G-6 (throwaway-schema harness), a `migration:create`-shows-no-diff acceptance check, G-7/G-8 in the step 2 and Phase 2 descriptions.
3. **After implementation (follow-up)** — G-9, G-10; move the DB suite into CI when a Postgres service exists; the agent-authentication spec remains the named public-deployment blocker.

## 🧪 Audit limits
- Read the full spec, `BACKWARD_COMPATIBILITY.md`, `doc/engineering-standards.md` (§2, §5, §7), `.ai/agentic.config.json`, product-brief entries R13/R14/R15/R17/D04–D09/A01/Q04/Q10/Q13, and the real sources named under Grounding. `doc/code-review-checklist.md` and `CODE_REVIEW.md` were applied from the earlier audit of this spec and spot-checked, not re-read line by line this run.
- MikroORM behaviour was verified by reading the installed 7.2.5 typings and `exceptions.js` (`nativeUpdate` return type, `TransactionPropagation.REQUIRED`, `DriverException` property copy). Nothing was executed: no Postgres, no migration, no tests, so `onUpdate` skipping in `nativeUpdate`, NESTED as the default propagation and the `refresh: true` re-read are taken from the previous audit and the spec, not re-run.
- Schema drift risk for `return_rma_seq` under `migration:create` is stated as a risk, not demonstrated.
- No suspected prompt injection found in the spec or guides.
