# Complaints with the vendor claim flow

Status: Implemented (PR #36). Open Questions Q1–Q11 were answered by the owner on 2026-10-25, and the owner **confirmed on 2026-10-25 the five design choices marked "proposed" below** (R07 deferral, escalation as a badge only, shared quantity pool, no shipping deduction on complaint refunds, 20-character vendor-rejection note; recorded as D14 and in the brief's R07 and Q07 rows). Still open outside the code: legal wording for R02/R04 and the shipping-cost rule, and the customer-data retention decision before real mail is enabled.

## 📝 TLDR
Customers who receive a defective product can today only start a return: the wizard has no defect description, serial number or repair-or-replace remedy, and an agent cannot pass a confirmed defect on to the supplier. Proposed (future behavior): a customer files a complaint (UC-03) on the same wizard, an agent decides it with the 14-day response deadline visible and an escalation badge after 10 days (R04, Q07), and for a confirmed defect the agent sends a claim to the vendor by e-mail and records the vendor's answer and credit note (UC-12). The owner chose this slice (D12, D13, 2026-10-25). There is no data on complaint volume or on how many complaints reach a vendor.

## 📝 Resolved decisions
Confirmed by the owner (Adam Adamczyk) in session on 2026-10-25, with the recommendation applied unless a different answer is noted.

| Id | Decision |
|---|---|
| Q1 | One spec, two shippable phases: Phase 1 complaints, Phase 2 vendor claim |
| Q2 | Evidence is text only: description, discovery date and serial number. No file upload in this slice; the agent asks for photos by e-mail if needed. R07's photo and video requirement is therefore **deferred** (see Decisions in play) |
| Q3 | No warehouse screen. The agent moves a complaint manually through receipt and records whether the defect is confirmed (as returns work today, AD-A1) |
| Q4 | Vendors live in a `suppliers` table the agent maintains in `/admin`; the agent picks the vendor for each claim. Vendor guidelines are free text shown to the agent, not an automatic check |
| Q5 | One claim per complaint. No batching of several complaints per vendor |
| Q6 | The claim leaves from one configured shared sender address, with the sending agent's address as Reply-To. With text-only evidence there is nothing to attach |
| Q7 | The agent records the vendor's answer: accepted or rejected, credit amount, reason, date, and later "credited". No accounting integration and no reminders to the vendor |
| Q8 | R04: the system shows the deadline (day 14) and a red escalation badge after day 10 and never changes an outcome by itself. Legal still has to check the customer-facing wording |
| Q9 | Remedies offered: repair, replacement, refund. Price reduction and store credit are out of this slice |
| Q10 | Complaints reuse the order lookup port (`ReturnOrder.deliveredAt` exists) and the order-scoped guest session |
| Q11 | A real SMTP adapter on `MailPort` is built in Phase 2 (today's only adapter logs and delivers nothing) |

## 📝 Problem Statement
Today a defective product goes through the returns flow, which has no way to say what is wrong, no serial number, no 24-month warranty window (R02), no repair or replacement remedy (R05) and no response clock (R04). Agents who confirm a defect then handle the vendor outside the system, so nothing records what was claimed, when, or what the vendor credited. The only evidence for how much this matters is the team's description in the concept (A01, A05 unverified); no data says how many complaints arrive or how many reach a vendor. The slice is a product decision (D12), not a measured need.

## 📝 Proposed Solution
- **Complaints are a second kind on the same request.** `return_requests.kind` already exists (Q04); a complaint is `kind = 'complaint'` with its own state machine, defect fields and remedy set. Same RMA sequence, same timeline, same inbox, same customer tracker.
- **The vendor claim is a new concept** (`supplier-claims`) hanging off a complaint with a confirmed defect, with its own small state machine (`draft → sent → accepted | rejected`, `accepted → credited`), primitives-map row "State machine".
- Alternatives that lost: a separate `complaints` table (duplicates the inbox, tracker and timeline; Q04 chose to extend); a generic claim batch per vendor (Q5); a vendor portal (D13).

## 📝 Architecture
- Existing, reused: `ReturnService`, the repository and `withOrderLock`, `defineStateMachine`, `dueAt`/`overdue` calendar helpers, `OrderLookup`, guest session, `apiHandler`/`makeCrudRoute`, the admin inbox and decision card, the `Timeline` and tracker components, `MailPort`.
- New in `core`: complaint state machine and eligibility (24-month window), complaint quote, escalation helpers, `suppliers` and `supplier-claims` services and validators, claim state machine, e-mail template rendering.
- New in `db`: entities, repositories and a migration for the new columns, `suppliers`, `supplier_claims`, its events and `supplier_claim_seq`.
- New in `app`: complaint branch in the wizard and tracker, inbox and decision-card changes, `/admin/suppliers`, `/admin/supplier-claims`, API routes, the SMTP adapter and its env selection in the composition root.
- Cross-system effects: the existing `POST /api/returns`, `/api/returns/quote` and `PATCH /api/returns/[id]` contracts gain a `kind` discriminator (additive, default `return`). `MailMessage` gains an optional `replyTo`. Turning on the SMTP transport makes the existing customer templates actually deliver; that is an opt-in setting, not a default.
- Dependency on future work: none. The supplier portal, warehouse screen, evidence upload and rules engine can follow without rework.

## 📝 Data Model
One expand-only migration, self-contained (frozen SQL, no imports from app code), `down` refuses once complaint or claim rows exist.

**`return_requests`** (extended): `defect_description text null`, `defect_discovered_on date null`, `defect_confirmed boolean null` (set when a complaint reaches `received`; null before, and for returns). `kind` gains the value `complaint`. `resolution` gains `repair` and `replacement` (column already `varchar(16)`).
**`return_request_items`**: `serial_number varchar(100) null`. Complaint items use reason code `defective`.
**`suppliers`**: `id`, `name`, `email`, `guidelines text null`, `active boolean default true`, timestamps. Disabled, never deleted, while claims reference them.
**`supplier_claims`**: `id`, `ref` (`SC-YYYY-NNNNN` from `supplier_claim_seq`), `return_request_id` (FK, **unique**: one claim per complaint), `supplier_id` (FK), `status` (`draft|sent|accepted|rejected|credited`), `subject text`, `body text` (snapshot of the e-mail as composed), `agent_id` (FK, creator), `sent_at`, `answered_at`, `credit_amount numeric(12,2) null`, `currency char(3)`, `answer_note text null`, `credited_at`, timestamps.
**`supplier_claim_events`**: same shape as `return_request_events` (type, from/to status, note, `agent_id`, `created_at`).

Sensitive data: the vendor e-mail carries order number, RMA, item, serial number and the customer's defect text. It never carries the customer's e-mail address. Customer free text may still contain personal data; the agent sees the composed body before it is sent. Retention for complaint data follows the open R16 decision (deferred, as for returns).

## 📝 API Contracts
All new agent routes pass `authenticate: requireAgent`; mutations go through the shared CSRF check; no `try/catch` in routes.

- `POST /api/returns/quote`, `POST /api/returns` (customer, guest session): body gains `kind: 'return' | 'complaint'` (default `return`). For `complaint`: items with `lineRef`, `quantity`, optional `serialNumber`; request-level `defectDescription` (min 20, max 2000 characters), `defectDiscoveredOn` (not in the future, not before delivery), `resolution` in `repair | replacement | refund`, `returnMethod`. Server re-checks the 24-month window and quantities under the order lock; `returnable=false` lines are accepted (R06). Refund amount is the line total, with no shipping deduction (proposed, see Risks).
- `PATCH /api/returns/[id]` (agent): for complaints the allowed moves follow the complaint state machine; the move to `received` requires `defectConfirmed: boolean`, rejected on any other target (400 `validation_error`, `fieldErrors.defectConfirmed`). The existing decision-note and refund-limit rules (R11, P6) apply unchanged.
- `GET/POST /api/suppliers`, `PATCH /api/suppliers/[id]` (agent; create and edit need `MANAGE_RULES`, list is open to every agent so claims can pick a vendor).
- `POST /api/supplier-claims` `{ returnId, supplierId, agentNote? }`: allowed only when the complaint has `defectConfirmed = true`; 409 `claim_exists` if one exists. Creates the claim as `draft`, composes the e-mail, and sends it in the same call. If sending fails the claim stays `draft` and the response says so.
- `POST /api/supplier-claims/[id]/send`: retries a `draft`. 409 `mail_not_configured` when the active transport does not deliver (the log adapter), so a claim is never marked `sent` without a real delivery attempt having succeeded.
- `PATCH /api/supplier-claims/[id]`: `{ status: 'accepted' | 'rejected' | 'credited', creditAmount?, note? }` through the claim state machine. `accepted` needs `creditAmount > 0` not above the claimed line total; `rejected` needs a note of at least 20 characters (proposed). Compare-and-set like returns.

Errors use the shared envelope and `AppError` codes.

## 📝 UI/UX
Copy is Polish only (D07). Admin pages use shadcn components, customer pages plain Tailwind; Storybook docs pages are updated for any new `ui` component.
- **Customer wizard (`/returns/new`)**: first choice "Zwrot" or "Reklamacja". The complaint path replaces the reason step with a defect step (description, discovery date, serial number per item) and the resolution step offers repair, replacement, refund with the legal hint that repair or replacement comes first (R05). No return shipping fee for complaints. Summary and RMA page as for returns.
- **Customer tracker (`/returns/[rma]`)**: same five stages; complaint copy for "Co teraz?". The promise stays "odpowiemy w ciągu 2 dni roboczych" (Q10); the 14 days are not shown to the customer.
- **Admin inbox (`/admin/returns`)**: kind column and filter; complaint rows show days left to day 14 and a red "Eskalacja" badge after day 10 with higher list position. There is no assignment concept, so the badge is visible to every agent; Q07's "goes to users with `MANAGE_RULES`" is reduced to this (proposed, needs owner confirmation).
- **Decision card (`/admin/returns/[id]`)**: shows defect details; at `received` the agent chooses "Wada potwierdzona" or "Brak wady"; with a confirmed defect a "Przekaż do dostawcy" section appears (vendor select, vendor guidelines text, preview of the e-mail, optional agent note).
- **`/admin/suppliers`**: simple list and form. **`/admin/supplier-claims`**: list with status, age and credit; claim page to record the vendor's answer. A `draft` shows "Nie wysłano" with a retry button.

## 📝 Edge Cases & Failure Scenarios
- Delivery more than 24 months ago or not delivered yet: the same lookup messages as returns, with the complaint-specific reason; the customer is told to contact the shop in prose (no portal path).
- A unit already claimed by an open return or complaint cannot be claimed again: the claimed-quantity pool is shared across kinds (proposed; prevents a double refund).
- Racing submits and retries: unchanged, under the canonical order-number lock and idempotency key.
- Agent confirms "Brak wady": the complaint continues to `resolved` without a vendor section; the timeline records the decision.
- Mail fails or the transport is `log`: the claim stays `draft`, the agent sees the reason and can retry; no claim is ever `sent` without a successful send.
- Vendor replies after 30 days or never: the agent can still record the answer; no reminder, no automatic state change.
- Two agents record the answer at once: compare-and-set; the loser gets 409.
- Vendor disabled while a claim is `sent`: the claim keeps its reference; it can still be answered.
- Production without a delivering transport: claim sending is refused with `mail_not_configured`; customer flows are unaffected.

## 📝 Risks & Impact Review
- **Hard to reverse:** the migration (expand-only; `down` refuses once complaint or claim rows exist); the `kind` discriminator on three public API contracts (additive); the SMTP transport once customers receive real mail.
- **Real mail is a behavior change.** Enabling `EASYRMS_MAIL_TRANSPORT=smtp` delivers customer and agent-invite e-mails for the first time. Needs a template render for all four templates, a privacy check, and the retention decision (R16) before use with real customers. Opt-in, off by default.
- **Legal (owner and legal must confirm):** R02/R04 wording shown to customers; that complaints carry no return shipping deduction (R12 speaks of returns); that deferring R07's photo and video requirement is acceptable.
- **Product direction call, not a rule violation:** this slice rests on assumptions (A01, A04, A05). It is the owner's choice (D12); the spec does not claim demand.
- **Security:** the vendor receives free text typed by customers; the agent reviews it before sending. No customer e-mail address leaves the system. The review the brief asks for before public deployment now also covers the SMTP configuration.
- **Per-process rate limits** and other open items from the login work are unchanged.

## 📝 Decisions in play
_The proposals below were confirmed by the owner on 2026-10-25 (D14)._
Relies on: D07 (Polish only), D09 (one app, API under `/api/<concept>`), D10 and D11 (agent identity, `MANAGE_RULES`), D12 and D13 (this slice, vendor claim by e-mail), N03 (resolution per request, not per item), R02, R04 (with Q07 escalation), R05, R06, R11 (refund limit applies to complaint refunds), R15 (decision note for rejection), Q07, Q10.
Proposes, with the owner to approve:
- **R07 deferred in part:** photos, video and serial-number requirements are not enforced (text only, Q2); record as "Odroczone" like R08 and R16 do.
- **Q07 reduced:** escalation is a badge and ordering for all agents, not routing to `MANAGE_RULES` users.
- **Shared quantity pool** across returns and complaints.
- **No shipping deduction on complaint refunds.**
- **Rejection note of at least 20 characters** on a vendor rejection (R15 uses 30 for customers).
Supersedes nothing.

## 📋 Phasing
- **Phase 1: complaints** (customer wizard and tracker, agent inbox and decision card). Independently shippable; value without Phase 2 is that complaints are filed, answered and deadline-tracked.
- **Phase 2: vendor claim** (suppliers, claims, SMTP delivery). Depends on Phase 1's `defectConfirmed`. Can ship with the transport left on `log`: claims then stay `draft`, which is visible and safe.

## 📋 Implementation Plan

### Phase 1 — Complaints
1. **Core: complaint model.** Add `complaint` kind, complaint state machine, `repair`/`replacement` resolutions, 24-month window helper (Warsaw calendar), complaint quote, `complaintDueAt` and escalation helpers; extend the submit and status Zod schemas. Pure unit tests in `core`. App unchanged and working.
2. **DB: migration and repository.** Columns on `return_requests` and items; repository handles the shared claimed-quantity pool, defect fields and `defectConfirmed` in `transition`. `test:db` covers the migration (up, `down` refusal) and the compare-and-set.
3. **Service and API.** `ReturnService.submit/quote` handle `kind`; `PATCH` enforces the complaint machine and `defectConfirmed`. Flow tests with the fake order port (window, shared pool, `returnable=false` accepted, replay).
4. **Customer wizard and tracker.** Kind choice, defect step, remedy step, complaint copy. Wizard-step logic stays in `core`.
5. **Admin inbox and decision card.** Kind column and filter, deadline and escalation badge, defect details, "Wada potwierdzona". Storybook page for any new `ui` component; `docs:check` green.
6. **Docs and records.** README (no new env in this phase), `doc/platform-primitives.md` rows, AGENTS.md current state, product brief ids (D12, D13, R07 deferral, Q07 reduction), implemented-spec move happens only after Phase 2.

### Phase 2 — Vendor claim
1. **Mail.** Extend `MailMessage` with `replyTo`, add `delivers` to `MailPort`, write template rendering for all four templates in `core` with tests, build the SMTP adapter in `app/src/server/`, select it with `EASYRMS_MAIL_TRANSPORT` (`log` default), `EASYRMS_SMTP_URL`, `EASYRMS_MAIL_FROM`; production fails closed when `smtp` is chosen and misconfigured. Document the variables in the README.
2. **Suppliers.** Entity, repository, service, validators, `/api/suppliers`, `/admin/suppliers`.
3. **Claim persistence and state machine.** Migration for `supplier_claims`, events and `supplier_claim_seq`; `SC-` reference formatter; claim state machine; repository with compare-and-set. `test:db` for the migration and the unique-per-complaint constraint.
4. **Claim service and routes.** Compose, create-and-send, retry, record answer; `mail_not_configured` and `claim_exists` paths; flow tests with a fake `MailPort` for delivery success, failure and non-delivering transport.
5. **Admin UI.** "Przekaż do dostawcy" section on the decision card, `/admin/supplier-claims`, answer form.
6. **Docs, QA evidence and close-out.** README, primitives map ("Reference numbers", "State machine", "Notifications" rows), product brief refresh, QA evidence under `doc/previdences/pr-<number>/`, move this spec to `.ai/specs/implemented/`.

Each step leaves the application working; every step that adds logic has tests in `core` or `db`, since `app` and `ui` have no runner.
