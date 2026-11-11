# Evidence audit events (T-23)

Source doc: `.ai/specs/implemented/2026-11-10-transport-damage-and-missing-items.md` (built; context only). Issue #145, part 2.

## Goal
Record who added, removed and (as an agent) downloaded an evidence photo, visible to agents only.

## Scope
Audit events only. Retention and erasure (T-21) stay in #145, which this work does not close.

## Design decisions (made by the assistant without asking, to be confirmed in review)
1. A separate table `evidence_audit_events` (like `return_rule_comparisons`), not new event types on the request timeline: `return_request_events` has no payload column, `to_status` is NOT NULL and the customer tracker maps every event to a timeline line (lesson 2026-11-08).
2. Columns: id, `evidence_file_id` uuid with **no foreign key** (the record outlives a deleted file), `order_number`, `return_request_id` nullable (set at attach), `action` (`added`, `removed`, `downloaded`), `actor` (`guest`, `agent`), `agent_id` nullable FK to agents (restrict), `created_at`.
3. Recorded: guest add, guest removal of a staged file, agent download. Not recorded: guest reads of their own files (thumbnail noise). Agent downloads are deduplicated per (agent, file) within 10 minutes in SQL.
4. Add and remove write the audit row in the same transaction as the change and fail closed. An agent download never blocks the read when the audit write fails; it is logged.
5. Visible to agents only: a read-only "Historia zdjęć" card on the decision card. Never in the customer tracker, `TrackerBody` or the customer preview.

## Non-goals
Retention job, erasure, customer-visible history, recording guest reads, claim mail.

## Risks
- `risk-high`: security-relevant, schema migration (expand-only, `down` refuses while rows exist).
- The download audit write runs on every agent thumbnail load; the dedup window bounds the volume.
- Browser QA needs the ClamAV container and QA credentials.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Audit events

- [x] 1.1 db: evidence_audit_events entity and migration, audit written in stage, deleteStaged, attach and agent download, listAudit — 76a614c
- [x] 1.2 core and app: actor context through EvidenceService and the routes, fail-closed rules — 76a614c
- [x] 1.3 app: Historia zdjęć card for agents — f9ea02c
- [x] 1.4 QA scenario EVD-003, evidence, threat model T-23, full gate — c5a7136

## Outcome

Audit events implemented; #145 stays open for retention and erasure (T-21).

- Gate: `typecheck`, `test` (core 1030, app 27), `lint` (0 errors), `docs:check`, `audit`, `storybook:build`, `NODE_ENV=production npm run build` green; `test:db` 190 passed (new: audit in the same transaction, fail closed for add and take-back, dedup window, attach ties rows to the request, rows outlive files, `down` refuses with rows, no foreign key on file or request).
- Scenarios against the running app with the real ClamAV container, all passing: EVD-003 (new), RET-011 (now also asserts the card shows the history and the customer preview does not), RET-012, EVD-001, EVD-002.
- Screenshots: `doc/previdences/pr-146/`.
- Not recorded by design: a customer reading their own photo; the staged take-backs that never became part of a request are in the table but not shown on any card (no request to show them on).
- Not done: retention and erasure (T-21), customer-visible history, a retention rule for the audit rows themselves (needs the same legal decision as the photos).
