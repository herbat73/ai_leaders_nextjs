# Evidence retention and erasure

Status: Implemented 2026-11-11 in one PR (#148, spec PR #147 closed unmerged; this file carries the spec as built). Built as specified except where "As built" below says otherwise. The open assumptions Q2, Q3 and Q8 were applied as written and are still to be confirmed by the owner and legal. Refs: issue #145 (closed by #148); brief R16, Q23; threat model T-21 (`doc/security/threat-model.md`); D21 spec `.ai/specs/implemented/2026-11-10-transport-damage-and-missing-items.md`. Part 2 of #145 (audit events, T-23) shipped in #146.

## 📝 TLDR
Photos and customer text are kept without limit today, and nothing calls the erasure code that already exists (`EvidenceService.deleteForRequest`). Proposed (future behavior): a retention job that, one year after a request is closed, deletes its photos and audit rows and anonymizes the personal text of the request, plus a documented command for a single customer's erasure request. Legal confirmed the period on 2026-11-11 (1 year, replacing the brief's undecided "3 years"); it comes from configuration, never from code.

## 📝 Resolved assumptions (autonomous defaults)
Legal's answer (1 year) is a confirmed input, not an assumption. The rest were open and are resolved to the smallest, most reversible option. Override any of them on the PR before merge.

| # | Question | Chosen answer | Why |
|---|---|---|---|
| Q1 | What triggers the job? | A CLI script `npm run retention:run` (precedent: `agent:create`), run by the operator's scheduler (cron, a scheduled container). No in-app scheduler, no admin screen. | No new infrastructure or public route; an admin button can follow. |
| Q2 | When does the 1-year clock start? | When the request reaches a final status (the last status event of a request in a final state of its state machine). Open requests are never touched. ⚠ NEEDS HUMAN CONFIRMATION | Deleting evidence of a case still being decided would harm the customer; legal's wording ("photo retention for 1 year") does not say whether it counts from upload or from closing. Counting from upload is stricter on privacy and simple to switch to. |
| Q3 | Delete the request row or anonymize it? | Anonymize in place; keep the row, order number, SKUs, quantities, amounts, statuses and timestamps. | Keeps counts and amounts for reporting and accounting; the order number alone does not identify a person once the e-mail and text are gone. ⚠ NEEDS HUMAN CONFIRMATION that legal accepts keeping the order number. |
| Q4 | Setting name and range | `EASYRMS_RETENTION_DAYS`, default `365`, whole number 30 to 3650; anything else is a configuration error (fail closed, nothing deleted). | Matches the other numeric settings (Q8 of D21); a floor prevents a typo wiping recent data. |
| Q5 | Rule for `evidence_audit_events` | Rows of an erased request are deleted in the same transaction; rows with no request (staged, never attached) are deleted once older than the retention period. The erasure itself is logged (counts and request id, no personal data), not added to the customer timeline. | After the files are gone the trail protects nobody, and the rows carry the order number. The customer tracker maps every timeline event to a line (lesson 2026-11-08), so a new event type is avoided. |
| Q6 | Customer erasure request | A documented procedure plus `npm run retention:erase -- --rma <RMA>`: same anonymization immediately, refused for a non-final request unless `--force`. | Reuses the job's code path; no customer-facing flow (GDPR art. 17 requests arrive by mail today). |
| Q7 | Copies outside the database | Out of scope; documented as limits: backups age out by the operator's backup rules (T-24), a supplier claim mail already sent cannot be recalled. | No photo reaches mail yet (T-22, Q9). |
| Q8 | Supplier claim text | The same run blanks `subject`, `body` and `answer_note` of claims linked to the erased request, because they quote the customer's defect text. ⚠ NEEDS HUMAN CONFIRMATION | Leaving the quoted text would defeat the anonymization. |

## 📝 Problem Statement
`doc/security/threat-model.md` T-21 and brief R16 list retention as the open control before real use. Facts from the code: files are stored in `evidence_files` (Postgres) with no expiry; `deleteForRequest` and `deleteStaged` exist and are tested but have no caller; `return_requests.customer_email`, `reason`, `defect_description`, `exchange_note`, `decision_note`, `return_request_items.comment`, `return_request_events.note` and the supplier claim texts hold personal or free text without limit. Turning on SMTP (`EASYRMS_MAIL_TRANSPORT=smtp`) makes this worse, which is why `Configuration.md` already says to decide retention first.

## 📝 Proposed Solution
Add a `RetentionService` in `core` behind a `RetentionPort`, implemented in `db`, called from one script in `app`. Considered and rejected: a Next.js route callable by a scheduler (new public surface needing auth and rate limits, T-02); an in-process timer (runs in every instance, dies with the process); hard-deleting the request row (loses reporting data, breaks the claim and timeline foreign keys).

Per eligible request, in its own transaction: delete its files (the existing `deleteForRequest`), delete its audit rows, null the free-text fields, replace `customer_email` with `erased-<rma>@anonymized.invalid` (the column is NOT NULL), blank the linked claim texts, and set `anonymized_at`. A request with `anonymized_at` set is skipped, so a rerun is safe.

## 📝 Architecture
- `core`: `parseRetentionDays(env)` (same shape as `parseManagerInviteTtl`), `RetentionService.run({ now, dryRun })` and `.eraseOne(rma, { force })`, `RetentionPort` (`findDue(cutoff, limit)`, `anonymize(requestId)`, `purgeOrphanAudit(cutoff)`). No React, Next.js or MikroORM.
- `db`: repository implementing the port with the SQL inside the repository only; one migration; entity change.
- `app`: `scripts/retention.ts` building a small container the way `agent-create.ts` does (it cannot import `server-only` code), `retention:run` and `retention:erase` in the root `package.json`, Awilix registration of the service in `registerCore`/`registerDb`.
- Effects on consumers: the customer tracker lists requests by the guest session's order (not by e-mail), so an anonymized request stays visible to its own customer with its status, without text or photos (the photo route answers 404). Agents see it marked "Zanonimizowano" on the card and in the list.

## 📝 Data Model
One migration: `return_requests.anonymized_at timestamptz null`, No index: a partial index would not be in the entity metadata and the next generated migration would drop it. No change to `evidence_files` or `evidence_audit_events`. The migration is reversible (drop the column); erasure itself is not, by design.

## 📝 API Contracts
No HTTP route. CLI:
- `npm run retention:run [-- --dry-run]` prints counts (requests anonymized, files deleted, audit rows deleted, failures); `--dry-run` prints the count and RMA numbers only. Exit 0 on success, 1 when any request failed, 2 on a configuration error.
- `npm run retention:erase -- --rma <RMA> [--force]` prints what it removed; exit 3 when the request is not found or not final without `--force`.

## 📝 UI/UX
The agent decision card shows "Zanonimizowano <date>" in place of the customer e-mail and hides the empty photo and note areas for an anonymized request. Nothing changes for customers. Prototype: none (one status line).

## 📝 Edge Cases & Failure Scenarios
- A run dies midway: each request is atomic, so it is either fully anonymized or untouched; the next run continues.
- One request fails (for example a lock timeout): it is logged with its id and skipped, the others continue, exit code 1.
- The period is shortened later: the next run erases more; the minimum of 30 days limits a typo. Lengthening it only delays.
- A request reopened after closing is non-final again and is skipped until it closes (the clock restarts).
- A staged file never attached is already purged after 2 hours on the next upload; the new rule only cleans audit rows of such files.
- The job must never log e-mail addresses, text or file content.

## 📝 Risks & Impact Review
- Irreversible deletion: mitigated by `--dry-run`, the floor of 30 days, the final-status rule and per-request transactions. A wrong period value cannot be undone except from backups.
- Product and legal calls (not code defects): the clock start (Q2), keeping the order number (Q3), claim texts (Q8). Marked for confirmation above.
- No existing contract changes: `evidence_audit_events` stays insert-only except for this purge; the new column is nullable.
- Backups and mail already sent are outside the control (Q7).

## 📝 Decisions in play
Relies on R16 (to be updated from "3 lata" to 1 year, owner and legal), Q23 (retention "wg prawnika", now answered: 1 year) and D21. Proposes no superseding of a Non-goal. Owner and legal approve the PR's brief change.

## 📝 As built
Differences from the design above, found while building and reviewing #148:
- **Tracker:** not a 404 for the customer (see Architecture); no tracker change was needed.
- **Orphan photos:** the job also deletes staged files that never reached a request once they are older than the retention period (`RetentionPort.purgeOrphans`), because the staged-file purge on the next upload only runs if there is one.
- **Erased claim drafts:** `SupplierClaimService.send` refuses a draft whose subject and body were erased (409 `claim_erased`), so an empty claim can never be mailed.
- **Concurrent erasure:** `anonymize` returns `erased: false` when the request was already erased, so `run` does not count it and `eraseOne` answers `alreadyErased`.
- **No browser scenario in the plan, one added:** QA scenario `RET-013` (`.ai/qa/RET/`), evidence in `doc/previdences/pr-148/`.
- **Open:** `retention:erase --force` and the scheduled run were not exercised; the clock start (Q2), keeping the order number (Q3) and blanking claim text (Q8) await confirmation.

## 📋 Phasing
- **Phase 1 — retention core and job.** Setting, service, port, repository, migration, scripts, tests, `Configuration.md`. Shippable alone: nothing runs until the operator schedules the script.
- **Phase 2 — erasure request and visibility.** `retention:erase`, runbook, decision-card "Zanonimizowano" state, QA scenario (RET-013), threat model and brief updates.

## 📋 Implementation Plan
Each step leaves the app working, ships with tests, and keeps `lint`, `typecheck`, `test` green.

**Phase 1**
1. `core`: `parseRetentionDays` (default 365, range 30 to 3650, invalid is an error) with unit tests for edges and bad values.
2. `db`: migration `anonymized_at`, entity update, `RetentionRepository` (`findDue`, `anonymize` in one transaction: files, audit rows, free text, e-mail placeholder, claim texts, `anonymized_at`; `purgeOrphanAudit`). Database repository tests (`npm run test:db`): a closed old request is fully anonymized and its files and audit rows are gone; an open request, a young closed request and an already anonymized request are untouched; the rows of another request survive.
3. `core`: `RetentionService.run` (batching by 100, per-request failure isolation, dry run, counts, no personal data in logs) with fake-port unit tests, including a failing request and a rerun.
4. `app`: `scripts/retention.ts`, `retention:run` in `package.json`, DI registration (explicit, no `loadModules`), `Configuration.md` entry (`EASYRMS_RETENTION_DAYS`, including the scheduling advice and that nothing is deleted until the script runs), `.env.example`.

**Phase 2**
5. `core` and `app`: `eraseOne` and `retention:erase` with the final-status guard and `--force`; tests for not found, not final, forced.
6. `app`: decision card state for an anonymized request, Storybook story, Polish copy; the tracker needs no change (see Architecture).
7. Docs: erasure runbook in `doc/` (who runs it, how the request is verified, what is and is not erased, backups and sent mail), threat model T-21 row and change log, brief R16 and Q23 (1 year, implemented), `.ai/specs/product-brief.md` Done list; QA scenario in `.ai/qa/RET/`.
