# Vitest test runner for @easyrms/core

Source doc: .ai/specs/2026-10-22-return-agent-decision.md (prerequisite PR, decision N4 approved by the user)

## Goal
Add a unit-test runner so every later code change can ship with tests: Vitest in `@easyrms/core`, a root `npm test`, and `npm test` in the validation gate.

## Scope
- Vitest as a dev dependency of `@easyrms/core` only (pure unit tests, no database, no React/Next).
- `test` script in `@easyrms/core`; root `npm test` runs every workspace that defines one (`--if-present`).
- One real first test file for the existing `ReturnService` and status helper (no placeholder test).
- `npm test` appended to the gate in `.ai/agentic.config.json`, mirrored in `SDLC.md`, `CODE_REVIEW.md`, `doc/code-review-checklist.md`, `README.md` and the AGENTS.md practical notes (SDLC.md requires them to change together).

## Non-goals
- No tests for `db`, `ui` or `app`; no DOM/component/Playwright runner; no coverage thresholds; no CI workflow (the repo has none); no feature work from the return specs.

## Implementation Plan

### Phase 1: Test runner
1. Add Vitest to `@easyrms/core` (`test` script, minimal config) and the root `npm test` script. Verify: `npm test` runs and reports zero tests cleanly (`--passWithNoTests` is NOT used from step 2 on).
2. Add `packages/core/src/services/returns/return.service.test.ts` covering `isReturnStatus`, `ReturnService.create`/`list` delegation and `updateStatus` (updated row returned; `NotFoundError` with status 404 when the repository returns null), using an in-memory fake repository. Verify: `npm test` passes; mutate an assertion locally to confirm a failure is reported.
3. Wire `npm test` into the gate (after `npm run typecheck`): `.ai/agentic.config.json`, `SDLC.md`, `CODE_REVIEW.md`, `doc/code-review-checklist.md`, `README.md`, AGENTS.md practical notes. Verify: the gate lists match across files.
4. Full validation gate. Verify: typecheck, test, lint, audit and production build all exit 0 (audit may fail on new transitive advisories: handle per `audit-allowlist.json` rules only with a reason and expiry, otherwise pick a patched Vitest).

## Risks
- Vitest pulls a large transitive tree (vite, esbuild); `npm run audit` (high+) may flag advisories. Mitigation: use the latest Vitest; allowlist only with a documented reason and expiry.
- ESLint must lint `*.test.ts` under the `core` import restrictions; `vitest` is not a forbidden import.
- `tsc --noEmit` in core already includes `src/**/*.ts`, so test files are typechecked; Vitest globals are NOT enabled (explicit imports).
- The primary checkout may set `NODE_ENV=development`; run the build with `NODE_ENV=production`.

## Progress

PR: #17

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Test runner

- [x] 1.1 Add Vitest to @easyrms/core and root npm test — 5875c7e
- [x] 1.2 First real unit tests for ReturnService — 4926c4d
- [x] 1.3 Wire npm test into the validation gate and docs — a551539
- [x] 1.4 Full validation gate

### Phase 2: Review fixes

- [x] 2.1 Use Vitest 4 (Node 20 compatible) and document the Node 20.19 floor in the README — fa560e0
