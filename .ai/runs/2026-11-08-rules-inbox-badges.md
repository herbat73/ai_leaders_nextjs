# Execution plan: rules inbox badges, Phase 2 (E04-S02, #109)

Source doc: .ai/specs/2026-11-08-rules-engine-recommendations.md
Issue: #109 (Closes), epic #31 (Refs). Phase 1: #108 / PR #112 (merged).

## Goal
With `EASYRMS_RULES_RECOMMENDATIONS=on`, the agent inbox shows text badges "Zalecana akceptacja" (R08/R09 recommend approval) and "Kierownik" (R10c, value from 2000 zł; hint only, R11 stays the gate) on requests awaiting a decision. Flag off: no field, no badge.

## Scope
`core` (`ReturnService.listInbox` attaches `recommendApprove`/`assignManager` per row of the fetched page), `app` (inbox column badges, Polish copy), README note, run log.

## Non-goals
R10a badge (no transport kind), filtering/sorting by recommendation, any change to the inbox query pushdown, `GET /api/returns` and `list()` (public, unpaged contract), Phase 3 (#110), moving the spec to `implemented/`.

## Risks
Badges only for `submitted` requests (the only status that can be approved or rejected). No new ui component, so no story. No db code, so no `test:db`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 2: Inbox signals

- [x] 2.1 core: listInbox attaches recommendApprove and assignManager (flag-gated) with tests — e0d5ba6
- [x] 2.2 app: inbox badges with text, Polish copy — e0d5ba6
- [x] 2.3 docs: README note, platform-primitives, run log — e0d5ba6

## Outcome

- Gate: typecheck, `npm test` (815 passed), lint (0 errors, 86 existing warnings), audit, docs:check, storybook:build, production build: green.
- No db code touched, so `test:db` not needed. No new ui component, so no story.
- Not exercised in a running app with the flag on (see PR QA).
