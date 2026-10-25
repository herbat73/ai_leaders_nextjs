# Execution plan: complaints with the vendor claim flow

Source doc: .ai/specs/implemented/2026-10-25-complaints-and-vendor-claim.md

## Goal
Implement the spec: customers file complaints (kind `complaint`) on the existing return flow; agents decide them with a 14-day deadline and escalation badge; for a confirmed defect an agent sends a claim to a vendor by e-mail and records the answer (Phase 2, with a real SMTP adapter).

## Scope
Everything in the spec's Phase 1 and Phase 2. Non-goals: supplier portal, warehouse screen, file upload, rules engine, price reduction and store credit for complaints.

## Assumptions (author's proposals in the spec, not yet confirmed by the owner) ⚠ NEEDS HUMAN CONFIRMATION
R07 photo/video requirement deferred (text-only evidence); escalation as badge only (no routing to `MANAGE_RULES`); shared claimed-quantity pool across returns and complaints; no shipping deduction on complaint refunds; vendor-rejection note of at least 20 characters. The PR stays a draft until the owner confirms these.

## Risks
Enabling `EASYRMS_MAIL_TRANSPORT=smtp` delivers real customer mail for the first time (opt-in, default `log`). Migration is expand-only; `down` refuses once complaint or claim rows exist. `app` and `ui` have no test runner, so logic lives in `core`/`db`.

## Implementation Plan
Phases and steps are those of the spec's Implementation Plan (Phase 1 steps 1-6, Phase 2 steps 1-6).

## Progress

PR: #36

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Complaints

- [x] 1.1 Core: complaint model — b9909a7
- [x] 1.2 DB: migration and repository — a292ed9
- [x] 1.3 Service and API — f7590bb
- [x] 1.4 Customer wizard and tracker — 8e626b7
- [x] 1.5 Admin inbox and decision card — 04a11c3
- [x] 1.6 Docs and records — 93e90ba

### Phase 2: Vendor claim

- [x] 2.1 Mail — 89cbf20
- [x] 2.2 Suppliers — 96d4dda
- [x] 2.3 Claim persistence and state machine — 13ac335
- [x] 2.4 Claim service and routes — 2e29997
- [x] 2.5 Admin UI — 2918c22
- [x] 2.6 Docs, QA evidence and close-out — e2e82e3
