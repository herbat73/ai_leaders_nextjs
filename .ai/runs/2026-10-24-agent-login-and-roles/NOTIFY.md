# Notify — 2026-10-24-agent-login-and-roles

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-10-24 — run started
- Brief: implement agent login and roles spec, all 4 phases, one PR
- External skill URLs: none
- Decisions: whole spec one PR; tsx approved; D10/D11 and finance reviewer flagged as outstanding

## 2026-10-24 — checkpoint 1
- Phase 1 complete; targeted gate green; curl and browser verification recorded in checkpoint-1-checks.md.
- Decision: login page uses a shared `sanitizeAdminNext` (core) and `getCurrentAgent()`; both reused by Phase 2.
- Decision: CrudForm gained a `password` field kind (show/hide), `autoComplete`, `pendingLabel`, `cancelLabel` (docs page and story updated).

## 2026-10-24 — checkpoint 2
- Phase 2 complete; guard, proxy, identity on events verified (checkpoint-2-checks.md).
- Blocker for merge, not for the run: human QA by a reviewer is required (risk-high, `needs-qa`); the run does not add `qa-approved`.
- Decision: `ReturnService.transition(id, status, note, agent)` takes the note as `string | undefined` (required position) so the agent can follow it.

## 2026-10-24 — checkpoint 3
- Phase 3 complete (checkpoint-3-checks.md). Lesson: Turbopack HMR can serve a stale server component; restart `next dev` when a nav/shell edit does not show.
