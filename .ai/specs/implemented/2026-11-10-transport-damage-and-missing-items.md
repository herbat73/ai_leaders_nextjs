# Transport damage and missing items with photo uploads

Status: Implemented 2026-11-11 in three phases: Phase 1 (#139), Phase 2 (#142), Phase 3 (#143); follow-up #140 closed. Not built, as the spec itself says: retention and automatic erasure (T-21), audit events for photo adds and downloads (T-23), photos in claim mail (Q9). Original status: Draft for owner review. Open Questions Q1–Q12 were answered on 2026-11-10 by the owner (Adam Adamczyk), who accepted every recommended answer (see Resolved decisions). Refs: brief D21, R03, R07, R16, Q14, Q23, A08; threat model section 5 (`doc/security/threat-model.md`, T-15 to T-24).

## 📝 TLDR
A customer whose parcel arrived damaged, or with an item missing or wrong, cannot report it: the portal takes only returns and complaints, and 20 of 50 cases in the sample were of these two kinds. Proposed (future behavior): the customer reports transport damage (UC-04) or a missing/wrong item (UC-05) in the same wizard within 14 days of delivery (R03), attaches at least one photo (required from Phase 3; Phase 1 ships without photos), and an agent decides it with the photos on the decision card. Photos are the risky part, so they ship as their own phase, with a scanner, re-encoding and order-scoped access as the threat model requires.

## 📝 Resolved decisions
Confirmed by the owner in session on 2026-11-10 with the recommended answer for each.

| Id | Decision |
|---|---|
| Q1 | One spec, three shippable phases; uploads are their own phase |
| Q2 | At least 1 photo required (transport: product or packaging; missing: package contents). Phase 1 ships text-only, an interim, owner-accepted deviation from Q14 and R07 until Phase 3 makes photos required |
| Q3 | Images only: JPEG, PNG, WebP. No video, PDF or SVG |
| Q4 | 5 MB per file, 6 files per request, 20 MB per order (the owner may change the numbers) |
| Q5 | Malware scan required; refuse uploads when the scanner is down (an extra service, ClamAV in `docker-compose`) |
| Q6 | Files in Postgres first, behind a port so a private store can replace them |
| Q7 | Re-encode every image and strip metadata at upload |
| Q8 | Delete files with their request when anonymizing; the retention period is set by legal, nothing hard-coded |
| Q9 | No carrier or supplier claim in this slice; photos never attach to vendor mail |
| Q10 | The 14-day window is an environment variable, default 14 |
| Q11 | "Was the parcel accepted with a courier note?" is optional |
| Q12 | No customer uploads after submit; the agent asks by mail as for complaints |

## 📝 Problem Statement
Today `CLAIM_KINDS` in `core` lists `transport` and `missing`, but nothing else uses them: no wizard, validator, state machine or screen. The sample (50 cases, one small shop, sampling undocumented, brief Q21) has 11 transport and 9 missing-item cases, 18 of 20 with a follow-up, median 7 and 4 messages, median value 799 zł and 130 zł `[DATA]`. That photos in the portal shorten those follow-ups is an assumption (A08); no cost is measured. Customers and agents exchange photos by mail and phone today.

## 📝 Proposed Solution
- **Two more kinds on the same request**, as complaints were: `kind = 'transport' | 'missing'` on `return_requests`; same RMA sequence, timeline, inbox, tracker, rules recommendations and order-scoped guest session. Alternative that lost: separate tables (duplicates inbox, tracker and timeline).
- **Evidence files as a new concept** (`evidence`), staged at upload and attached at submit. Files are scanned and re-encoded **before** they are stored, so unscanned bytes are never persisted (this replaces a quarantine state, T-16).
- **No return leg.** Neither kind asks for a return method. The state machine is `submitted → approved | rejected`, `approved → resolved` (docs/02 §2.6: a return is usually unnecessary). If the agent needs the goods back, they ask by mail (see Risks).
- Remedies: transport = `replacement | refund`; missing = `resend_part | replacement | refund`. Same remedy for the whole request (R13, N03).
- Research: the plan follows the OWASP File Upload Cheat Sheet as I know it (allow-list by content, re-encode, generated names, authorization on download, store away from the web root); I did not re-fetch it. No open-source returns product was checked for upload handling; Claimlane, the brief's pattern source, was never reviewed (brief D01).

## 📝 Architecture
- Reused: `ReturnService`, `ReturnRepository`/`withOrderLock`, `defineStateMachine`, `OrderLookup`, guest session, `apiHandler`, the Postgres throttle store, the admin inbox and decision card, the tracker, the rules engine (R09 and R10a start matching when the kinds exist; recommend-only, D17).
- New in `core` (no React, Next or MikroORM): `damageStateMachine`, eligibility with the configurable window, quote reuse, validators, wizard steps for both kinds, `EvidencePort` (repository contract), `MalwareScannerPort`, `ImageSanitizerPort`, an `EvidenceService` (limits, scan, sanitize, store, authorize).
- New in `db`: entity, repository and migration for evidence files and the new request column.
- New in `app`: ClamAV adapter (clamd `INSTREAM` over TCP), sharp-based sanitizer (new dependency in `@easyrms/app` only), upload and download routes, wizard pages, decision-card and tracker changes, env wiring, `docker-compose` ClamAV service.
- Next.js constraint (from `node_modules/next/dist/docs`, `proxyClientMaxBodySize`): when `proxy.ts` runs on a route it buffers the body up to 10 MB and silently truncates beyond it instead of failing. The proxy matcher lists only agent paths today; the upload route is a customer path and **must stay out of it**. The route enforces its own cap by reading the stream with a limit.
- Cross-system effects: `POST /api/returns` and `/api/returns/quote` gain two `kind` values (additive); `ReturnResolution` gains `resend_part` (the column is `varchar(16)`). Enabling transport turns R10a's recommendation on in the inbox when `EASYRMS_RULES_RECOMMENDATIONS` is `on`.

## 📝 Data Model
One expand-only, self-contained migration; `down` refuses once evidence rows exist.

- **`return_requests`**: `courier_note boolean null` (transport only; Q11). `defect_description` and `defect_discovered_on` are reused for transport and missing (what is wrong or missing; the date noticed). Both are null-safe already.
- **`evidence_files`**: `id uuid` (random, unguessable), `order_number varchar(100)` (scoping key, index), `return_request_id` FK null (null while staged, set at submit), `content_type varchar(16)` (`image/jpeg|png|webp`, always the re-encoded type), `byte_size int`, `sha256 char(64)`, `label varchar(120)` (sanitized original name, display only), `data bytea`, `created_at`. No update path after attach: files are immutable (T-23). Delete rule on the request FK: `restrict`.
- Item reason codes: `damaged_in_transit`, `missing_element`, `wrong_item` (a dictionary on the item row, as for complaints).

Sensitive data: photos can show a home, a person or an address. Metadata is stripped (Q7); files are never mailed to a vendor (Q9); they are served only through the authorizing route. Retention follows R16 (Q8, see Risks).

## 📝 API Contracts
All routes use `apiHandler`; no `try/catch` in routes; mutations use the shared CSRF check; the 16 KB JSON cap stays for every JSON route.

- `POST /api/returns/quote`, `POST /api/returns` (guest): `kind: 'transport' | 'missing'`, `items[{lineRef, quantity}]`, `defectDescription` (20–2000 chars), `defectDiscoveredOn` (not future, not before delivery), `courierNote?` (transport), `resolution`, `evidenceFileIds` (Phase 2+: 1 to 6 ids, all staged by this session's order), `acknowledged`, `idempotencyKey`. Eligibility: delivered, within `EASYRMS_TRANSPORT_WINDOW_DAYS` (default 14, valid 1–30) of delivery, shared quantity pool with open returns and complaints (D14), `returnable=false` lines allowed. Refund amount is the line value, subject to the R11 limit.
- `POST /api/evidence` (guest, multipart, **one file per request**): `file` part only. Reads the stream with a hard cap (5 MB + overhead), checks the **detected** type against the allow-list (not the client type or extension), enforces per-order quota (20 MB) and per-request count (6, counting staged files), decodes under a pixel limit, scans, re-encodes without metadata, stores, returns `{ id, byteSize, contentType }`. Errors: 400 `not_an_image`, 413 `too_large`, 409 `quota_exceeded`, 429 throttled, 503 `scanner_unavailable` (fail closed), 422 `rejected` (infected or undecodable; the message does not say which).
- `GET /api/evidence/[id]`: agent session, or guest session whose order equals the file's `order_number`; anything else returns the same 404. Headers: `Content-Type` from the row, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename="evidence-<id>.<ext>"`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`.
- `PATCH /api/returns/[id]` (agent): transport and missing follow the new state machine; the existing decision-note, refund-limit (R11) and compare-and-set rules apply unchanged. No `defectConfirmed` for these kinds (400 as for returns).
- Throttle: uploads use the Postgres throttle store with a per-(order, IP) budget (20 per 10 minutes, a starting value for the owner to confirm).

## 📝 UI/UX
All copy Polish only (D07). Public pages Tailwind, admin pages shadcn/ui.

- **Entry:** the returns page gains two cards next to Return and Complaint: "Uszkodzenie w transporcie" and "Brak elementu / inny produkt". One shared wizard, parameterized by kind, like the complaint wizard.
- **Steps:** items → details (description; noticed-on date; courier-note question for transport; "which element is missing" prompt for missing) → photos (Phase 3) → remedy → summary.
- **Photos step:** a labelled file input with `accept="image/jpeg,image/png,image/webp"`, one upload per file with per-file progress and a text error per file, remove-before-submit for staged files, counters against the 6-file and 5 MB limits, keyboard operable, no drag-and-drop dependency. Empty state shows what a good photo is.
- **Agent decision card:** description, courier note, thumbnails that open the full image in the same tab, R10a "wysoki priorytet" recommendation badge. **Tracker:** the customer sees their own thumbnails and a status path of Zgłoszone → Rozpatrywane → Rozwiązane for these kinds.
- States: loading, empty, error (scanner down: "Nie możemy teraz przyjąć zdjęć, spróbuj za chwilę"), success. Prototype: none accepted.

## 📝 Edge Cases & Failure Scenarios
- Scanner or sanitizer down: the upload returns 503 and nothing is stored; the customer can retry; submission is blocked while no photo is staged (Phase 3).
- Staged files never attached: deleted lazily on the next upload for that order once older than the guest session (2 h); no scheduler.
- Two tabs, same order: the quota and the count are enforced in one SQL statement under the order lock, so both cannot exceed 20 MB or 6 files.
- Customer double-submits: the idempotency key returns the first request; evidence ids attach once; ids already attached to another request return 409.
- Evidence ids of another order or already attached: rejected with the same 400 as an unknown id.
- File with the wrong extension or declared type: rejected on detected content. Oversized image dimensions: rejected before decoding fully. EXIF with location: stripped, never served.
- Window passes while filling in: server validation fails on submit with an explanation (as complaints).
- Download without a session, with another order's session, or for a deleted file: the same 404.
- Agent views a file while the customer's request is rejected: still readable by agents; retention applies.

## 📝 Risks & Impact Review
- **Risk class `risk-high`** (new public contract, schema migration, security-sensitive, new infrastructure). Needs a security review before any public deployment and a second reviewer; threat model section 5 is the checklist.
- **New dependencies and a service:** `sharp` (native) in `@easyrms/app` and a ClamAV container. This needs the owner's explicit approval on the PR (the answers to Q5 and Q7 imply it); both must be in the T-14 supply-chain check. Not approved until the owner reviews this spec.
- **Hard to reverse:** the migration, the evidence table and the `resend_part` value. Rollback: `down` refuses once data exists, so rollback after launch needs a data decision.
- **Residual risks the spec does not close:**
  - T-21 retention: a deletion method exists and is tested, but nothing calls it automatically; no anonymization job exists and R16 stays undecided. Legal must set the period before launch.
  - T-23 audit: file adds are not timeline events (the events table has no payload column and `to_status` is NOT NULL, see lesson 2026-11-08); downloads are not logged. Immutability and the SHA-256 are the controls.
  - T-24: Postgres storage removes the store-misconfiguration class but grows the database and its backups; revisit with a private store if volume grows.
- **Design calls the owner should confirm** (not asked at the gate): no return leg for either kind; reuse of the complaint columns for description and date; `resend_part` as a remedy; the 20-per-10-minutes upload budget.
- Evidence of impact is thin: A08 is untested and cannot be tested before go-live (brief Q22). This is a product direction call, not a finding.

## 📝 Decisions in play
- D21 (this slice, uploads included), D20 (D15 retired), D17 (recommendations only; no auto-decision), D14 (shared quantity pool), D07 (Polish only).
- R03, R07 (ends its deferral for these kinds), R09, R10a, R11, R13 and N03 (no per-item remedy), R16 (retention, still undecided), Q14 (≥ 1 photo for transport).
- Q23 is answered by Resolved decisions Q3–Q8; security and legal still have to confirm Q5 to Q8 before Phase 2 merges.
- Supersedes nothing active. Owner: Adam Adamczyk; security for Phase 2; legal for retention.

## 📋 Phasing
- **Phase 1 — the two kinds, text evidence.** Customers report transport damage or a missing item and agents decide them; no files. Shippable alone (as complaints were). Ends the "app rejects 40% of cases" gap for the text part. Interim deviation from Q14 (at least 1 photo for transport): accepted by the owner under Q2 until Phase 3. No thumbnails on the agent card or tracker, and the wizard has no photo step, until Phase 3.
- **Phase 2 — evidence backend.** Gate: security and legal confirm Q5 to Q8 and the owner approves the new dependencies before step 6 starts. Ports, scanner and sanitizer adapters, table, upload and download routes, limits, throttle, configuration, threat-model status update. No change to `POST /api/returns`; no UI; testable by API and integration tests; not user-visible.
- **Phase 3 — photos in the product.** Submit accepts evidence (the public contract change), wizard photo step with ≥ 1 photo required, agent card thumbnails, tracker thumbnails, QA scenarios.

## 📋 Implementation Plan
Each step leaves the app working and ships with tests; `npm run lint`, `typecheck` and `test` stay green.

**Phase 1**
1. `core`: request kinds `transport` and `missing` in `REQUEST_KINDS`, `damageStateMachine` and `stateMachineFor`, resolutions `resend_part`, reason codes. Unit tests for every move and for rejected moves.
2. `core`: eligibility with `EASYRMS_TRANSPORT_WINDOW_DAYS` (default 14, range 1–30, invalid value fails like other settings), shared quantity pool; quote reuse. Tests for window edges and the pool.
3. `core`: submit and quote validators for both kinds (no `evidenceFileIds` yet), wizard step logic, service branch in `ReturnService.submit`. Tests: happy paths, future date, before delivery, duplicate line, refund over the limit.
4. `db`: migration (`courier_note`), entity update, repository mapping, repository test with a database.
5a. `app`: `POST /api/returns`, `/quote` and `PATCH /api/returns/[id]` accept the new kinds; route and integration tests.
5b. `app`: customer side: entry cards, wizard, summary, tracker stage mapping and Polish copy.
5c. `app`: agent side: inbox kind filter and decision card with the R10a badge; QA scenario modelled on `.ai/qa/RET/`.

**Phase 2**
6. `core`: `EvidencePort`, `MalwareScannerPort`, `ImageSanitizerPort`, `EvidenceService` with limits and ordering (limit → decode → scan → sanitize → store). Unit tests with fakes: infected, scanner down (fails closed), oversize, quota, wrong type.
7. `db`: evidence entity, migration, repository (staged insert under the order lock with quota, attach, delete-for-request, orphan purge). Repository tests including the two-tab quota race.
8. `app`: ClamAV adapter and `sharp` sanitizer (the Phase 2 gate must have passed), env wiring in the composition root, `docker-compose` ClamAV service, `Configuration.md` and `.env.example` entries. Contract tests with a stub clamd (clean, infected, timeout, closed socket).
9. `app`: `POST /api/evidence` (stream-capped multipart, one file) and `GET /api/evidence/[id]` with the headers above; keep both out of `proxy.ts`. Integration tests: two seeded orders and two agents (cross-order read, upload to another order, no cookie), the headers on download, 413 and 429, 503 with the scanner stopped, an EICAR test file. Update the threat model statuses for the controls this phase delivers (T-15 to T-20, T-24).

**Phase 3**
10. `core` and `app`: `POST /api/returns` accepts `evidenceFileIds` for these kinds (optional in this step), attached once and validated against the order. Tests: idempotency, another order's id, an already attached id, and attach-then-purge of staged files older than the guest session.
11. `core` and `app`: `evidenceFileIds` required (1 to 6) for these kinds; wizard photo step with progress, errors, removal and counters; accessibility check.
12. `app`: decision-card thumbnails and tracker thumbnails through the download route; Storybook stories for the new components; `npm run storybook:build`.
13. QA scenarios and evidence under `doc/previdences/pr-<n>/`; update the brief (R07, Q23, A08) and the threat-model rows T-21 to T-23 (the residual risks); run the full gate.
