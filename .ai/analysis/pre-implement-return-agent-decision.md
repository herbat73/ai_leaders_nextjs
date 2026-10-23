# 🔍 Pre-implementation analysis: Return agent decision: status model, timeline, inbox and decision card

**Readiness: go** — All ten gaps from the previous audit (G-1..G-10) are resolved in the spec text, no Critical or Important finding remains, and the BC story is complete. Three Nice-to-have wording items are left. They do not block implementation.

> **Re-audit 2026-10-23 (third run).** N-1 (BC row 6 now says `test:db` is additive), N-2 (P8 caps `x-request-id` at 64 chars of `[A-Za-z0-9._-]`) and N-3 (step 2 names `audit`; the primitives doc says "planned") are now in the spec text. Grounding re-checked: `apiHandler` still logs `{ error }`, `ConflictError` has no `fields` yet, repository `list()`/`findById`/`updateStatus` and the `"requested"` fallback exist as the spec describes, root `test` runs workspaces with `--if-present`, and `@easyrms/db` has no test script. No open findings. Readiness: go.
Spec: `.ai/specs/2026-10-22-return-agent-decision.md` (Status: Approved; P1-P8 confirmed in session 2026-10-23) · audited 2026-10-23 against `BACKWARD_COMPATIBILITY.md` (all 5 surfaces), template: built-in section set (no `paths.specTemplate`, no template file), review rules `doc/code-review-checklist.md` + `CODE_REVIEW.md`, `doc/engineering-standards.md`, `.ai/specs/product-brief.md`. This is a second re-audit after the spec was revised for G-1..G-10; it replaces the earlier report at this path (git history keeps it).

## ⚠️ Decisions for the spec owner
- **Scope cohesion (unchanged, no action).** One change set carries the status model, the DB test runner (P5), the shared-layer `apiHandler` logging change (P8) and two UI primitives. The spec already stages it (step 1 additive, step 2 cut-over) and says the `apiHandler` commit may ship first as its own PR. Recommendation: keep as is.
- **Accepted deviations (no action):** single-migration status rewrite instead of expand/migrate/contract, forward-only `down` (BC §2 asks for a working `down`; P2 documents the refusal), DB suite outside the CI gate. All stated and owner-confirmed.

## 📋 Readiness gate
| # | Item | Result | Evidence / fix |
|---|------|--------|----------------|
| R1 | Declared status | ✅ | Line 3 `Status: Approved`, P1-P8 confirmed 2026-10-23. |
| R2 | No blocking open questions | ✅ | No Open Questions block, no `⚠ NEEDS HUMAN CONFIRMATION` entry. |
| R3 | Traceability / oracles | ✅ | Each rule has a named oracle: RMA format and year boundary, backfill order and sequence continuity (P5 test: first new RMA = backfilled count + 1), due-marker table, P6, P8 log test, concurrency, `down` refusal. Phase 2 UI rests on manual acceptance, justified by the absence of a UI runner. |
| R4 | Contracts defined | ✅ | GET/PATCH/POST shapes, 400/404/409 rules and ordering, port signatures (`transition`, `findDetail`, `findStatus`, `list(filter?)`), `ReturnListItem`/`ReturnDetail`, UI primitives and states, Next 16 page rules. |
| R5 | Phases deliverable | ✅ | Dependencies and exit gates stated (step 2 ends on the full gate plus `test:db`, step 3 recorded Postgres run is the merge gate, Phase 2 needs Phase 1 merged). |
| R6 | Grounded in the codebase | ✅ | Verified below; no mis-description found. |

**Grounding (R6), re-verified against the code this run:**
- `apiHandler` (`packages/core/src/http/api-handler.ts`) takes `(request, context)`, so `new URL(request.url).pathname` and the `x-request-id` header are both reachable. It still logs `{ error }` verbatim on the 500 path, as the spec says.
- `return.repository.ts`: `list()` takes no argument today, so the new `list(filter?)` signature is a real change (and BC row 5 now says so). It already imports `isReturnStatus` from `core` at runtime. `toDomain` falls back to `"requested"` for unknown values, the behaviour the spec replaces. `updateStatus` and `findById` exist and leave the port.
- `packages/db/package.json` has no `test` script and no Vitest. Root `package.json` has `"test": "npm run test --workspaces --if-present"` and no `test:db`, so the spec's `test:db` naming is correct and keeps the suite out of `npm test`.
- `db/src/config.ts`: Migrator with `transactional: true`, pool min 2 (so two separate forks for the concurrency test are available). `migrations/` holds only `Migration20261013164552.ts`, which has no `down`.
- `container.ts` is the only `Cradle` site, in `app`. Consistent with the logger and `clock` additions.
- Sibling spec `2026-10-22-return-customer-portal.md`: S10 reuses the P5 runner and says it merges after this spec; `withOrderLock` and `transition()` prerequisites match the names here (`transition(id, status, note?)` on the service, `transition(id, from, to, note)` on the port); S4 treats `decision_note` as customer-visible for approve/reject only, consistent with P6; it handles the `unknown` status.
- Product brief (checked in the earlier audit, unchanged): R13, R15, D06, D07 active as cited; no contradiction.

## Resolution of the earlier gaps
| Gap | Status | Where it is now |
|---|---|---|
| G-1 service pre-read | ✅ resolved | Architecture "Types and read paths": port gains `findStatus(id)`; null is a 404 before any write; the note never leaves `findDetail`. |
| G-2 `list` signature, BC row wording | ✅ resolved | `list(filter?: { status?: ReturnStatus \| "unknown" })`, `unknown` = status not in the nine values, fake implements the same; BC row 5 now says "takes a `filter` argument". |
| G-3 db test script wiring | ✅ resolved | P5: package script `test:db` (never `test`), root `"test:db": "npm run test:db -w @easyrms/db"`, vitest devDependency, config (`include`, `fileParallelism: false`), clear failure when Postgres is unreachable, typecheck and audit stay green. |
| G-4 RMA backfill mechanics | ✅ resolved | Data Model/Architecture: ordered by `created_at`, `id`; `nextval` once per row; TypeScript loop with frozen formatter (P7); P5 test creates one request after migration and expects backfilled count + 1. |
| G-5 P8 request id and route | ✅ resolved | P8: `crypto.randomUUID()` unless `x-request-id` present, never returned; route is `pathname` only; fixture is `DriverException`-shaped. Step 1 test lists it. |
| G-6 DB harness | ✅ resolved | Step 2: throwaway schema per file, run only `Migration20261013164552`, seed legacy rows (the listed cases), run new migration, Migrator `schema` option or `search_path`, two forks for concurrency. |
| G-7 Next 16 page rules | ✅ resolved | UI/UX "Next.js 16 pages": awaited Promises, doc path cited, invalid `?status=` shows unfiltered list plus message, non-numeric id `notFound()`, Server Component reads `getDetail` through the request scope. |
| G-8 PATCH ordering, trimmed note | ✅ resolved | API table: schema validation (400) before state machine (409); stored note is the trimmed value. |
| G-9 `fieldErrors.status` semantics | ✅ resolved | API table: carries a status value for the refresh, not display text. |
| G-10 `down` guard duplication | ✅ resolved | Data Model: the event check is the guard; the status check is kept only as a belt-and-braces test. |
| `migration:create` no-diff check | ✅ resolved | Step 2: acceptance includes that `migration:create` shows no diff after the migration and snapshot update. |
| db -> core import interpretation | ✅ resolved | Types and read paths: shared status/format helpers count as shared domain logic (as `isReturnStatus` already does); migration imports nothing from `core` (P7). |

## 💥 Backward compatibility
All five `BACKWARD_COMPATIBILITY.md` surfaces audited against every phase and step. The spec's own section is present and the required paths are named. No Critical, no Warning.

| # | Surface | Phase/step | Change | Severity | Migration path |
|---|---------|------------|--------|----------|----------------|
| 1 | §1 HTTP API | P1 step 2 | Status value set replaced; PATCH state machine and reject rule; new 409/400 paths; additive response fields | breaking, compliant | Consumers updated same PR, "Breaking changes" heading in PR body. |
| 2 | §2 Database | P1 step 2 | New columns/table/sequence, in-place status rewrite, first `down` | breaking, compliant (accepted deviation) | New migration, snapshot updated, rollback note (forward-only after first use, P2). |
| 3 | §3 Internal APIs | P1 steps 1-2 | `RETURN_STATUSES`, `ReturnRequest`, port and service changes, `ConflictError` `fields`, `apiHandler` 500 log | breaking, compliant | All in-repo consumers listed and updated; additive items checked against every existing route. |
| 4 | §4 Scripts | P1 step 2 (P5) | New root script `test:db` | additive | See N-1: spec's BC row 6 says "untouched", which contradicts P5. |
| 5 | §5 Process | P2 step 4 | Spec moved to `implemented/`, run-log naming | compliant | None. |

## 🔍 Repo-rule compliance
No violation found. `nextval` and migration SQL are parameterised and inside `db` (P4; engineering-standards §5); concurrency test required by the checklist is covered by the P5 suite and the scripted run; `apiHandler` use for the GET route is allowed by standards §2; no Server Actions; stories live under `ui/src/storybook/`; Polish copy per D07.

## ⚠️ Risks
| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| DB suite outside CI (P5) | Medium | A migration or compare-and-set regression passes the gate | Spec records `npm run test:db` per PR in `.ai/runs/`, and the scripted Postgres run is the merge gate. |
| `migration:create` drift (sequence, hand-edited snapshot, events entity) | Low | Next generated migration could drop or recreate objects | Now mitigated by the no-diff acceptance check. Prefer regenerating the snapshot from the CLI over hand-editing JSON. |
| `apiHandler` change touches every route | Low | A mistake blinds 500 diagnostics | Step 1 tests (value-free log, `code`/`constraint` kept); own commit, may ship first. |
| No agent auth (AD-A2), hard-to-reverse status names and RMA format | Low (accepted) | Product-level | Named blocker recorded in Phase 2 step 4 and the README. |

## 🔍 Gaps
- **Nice-to-have**
  - **N-1 BC row 6 contradicts P5.** Row 6 says "No variable or script added or renamed. Untouched", but P5 adds the root script `test:db` (BC §4 surface; it is additive and the README update is already in step 2). Fix the wording: "Additive: root script `test:db`, documented in the README".
  - **N-2 Client-supplied `x-request-id` is logged as is (P8).** Cap its length and character set (for example, accept only `[A-Za-z0-9-]{1,64}`, otherwise generate a UUID) so a caller cannot inject log lines or oversized values. One sentence in P8 and one test case.
  - **N-3 Gate wording.** Step 2's "full gate green" lists `typecheck`, `test`, `lint`, `build`, but not `audit` (the new `vitest` devDependency in `@easyrms/db` is exactly what could trip it; P5 does say audit stays green). Name `audit` in step 2's exit line. Also, UI/UX says `doc/platform-primitives.md` marks `Timeline` "as built by this spec" while the doc currently says "planned". Update the doc in Phase 2 step 4 or say "will be marked".

## 📋 Remediation plan
1. **Before implementation** — none required. Optionally fold N-1..N-3 into the spec.
2. **During implementation (add to the plan)** — none needed for the verdict. Take N-1..N-3 along with the step they belong to (N-2 in step 1 with the P8 test, N-3 in step 2, N-1 in the PR's BC table).
3. **After implementation (follow-up)** — move the DB suite into CI when a Postgres service exists; the agent-authentication spec remains the named public-deployment blocker.

## 🧪 Audit limits
- Read the full spec, `BACKWARD_COMPATIBILITY.md`, `.ai/agentic.config.json`, the previous report, the readiness/BC/compliance references, and the real sources named under Grounding (`api-handler.ts`, `return.repository.ts`, `db/package.json`, `db/src/config.ts`, root `package.json`, `container.ts`, the migrations folder) and the sibling portal spec (S1, S4, S7, S10, step 1, 5, 6a-6c). `doc/engineering-standards.md`, `doc/code-review-checklist.md`, `CODE_REVIEW.md` and the product-brief entries were applied from the earlier audit and spot-checked, not re-read line by line this run.
- Nothing was executed: no Postgres, migration, or tests. MikroORM behaviours the spec relies on (`nativeUpdate` return count and skipped `onUpdate`, `TransactionPropagation.REQUIRED`, NESTED default, `refresh: true` re-read, Migrator `schema` option and running only the first migration) were checked against typings in the previous audit or taken from the spec; the Migrator `schema`/partial-run support in particular is not demonstrated and is left to the step 2 harness (the spec offers `search_path` as the alternative).
- No suspected prompt injection found in the spec or guides.
