# Platform primitives (map, non-binding)

Source: `.ai/specs/implemented/2026-10-22-case-sample-lab-and-platform-primitives.md` (written there, moved here after its architectural review of 2026-10-23). Taken from UC-01…UC-15, screens K/Z/B/D/X and the API catalog (`docs/05`) via the product brief.

Primitives marked **design** are **non-binding proposals**: a sketch of the contract, built and approved by the first spec that needs it (YAGNI, `doc/engineering-standards.md` §4). Listing one here does not approve it. The spec that needs it starts from the sketch and may change it, but should not build a parallel mechanism. "Built by" rows are kept in step with the specs that build them; when a spec lands, update its row.

## Backend (`core`; persistence in `db`)

| Primitive | Contract sketch | Consumers in the backlog | Status |
|---|---|---|---|
| Rules engine | closed, provisional `Condition`/`Action` vocabulary, `evaluate`, `simulate`, `withThresholds`, `describeRule` | UC-09, UC-14/B-05, R07 evidence, R10 routing | built (case-sample lab spec, PR #26) |
| `ClaimKind`, `ProductCategory`, `ClaimFacts` | normalized rule input: kind, value, categories; later + reasons, days since delivery, supplier | rules, eligibility (UC-02…05), quote (Z-04) | built (case-sample lab spec, PR #26; the portal defines its own order and quote types, not `ClaimFacts`) |
| `Money` | integer minor units, `PLN` only for now; parse (pl/en), compare, `multiplyMoney(m, qty)`, format pl-PL | quote, R11 limits, refunds, supplier notes, analytics | parse/compare/format/`multiplyMoney` built (case-sample lab spec (Phase 1 step 1, PR #26); `addMoney`, `applyRate` built (customer portal spec) |
| Metrics | `share` (Wilson 95%), `median`, `percentile`, `groupBy` over plain rows | B-06, #15 KPI baselines, the lab report | built (case-sample lab spec, PR #26) |
| Tabular import | `parseTable(text, rowSchema, { maxRows, cellGuard }) → rows \| errors[{ line, column, message }], droppedColumns` | the lab; later bulk import / B2B (N01) | built (case-sample lab spec, PR #26) |
| State machine | `defineStateMachine({ states, transitions, guards }) → { can, assert, next, allowed }`; throws `ConflictError` | claims (9 statuses), supplier claims DRAFT→SENT→ACCEPTED/REJECTED→CREDITED, uploads | built by the agent decision spec (Phase 1); a second machine for complaints (`complaintStateMachine`, `stateMachineFor(kind)`) and the supplier claim machine (`supplierClaimStateMachine`, draft→sent→accepted/rejected, accepted→credited) built by the complaints spec |
| Domain events + timeline | `DomainEvent { id: "concept.entity.action", aggregateId, actor, at, payload }`; one typed in-process emitter; timeline = events projected per aggregate | K-05, B-02, R11 audit, mail triggers | design (the agent spec keeps a per-concept `return_request_events` table instead) |
| Ports & adapters | `<Name>Port` + mock adapter, env-selected, fail closed in production | carrier, payments, vouchers, AV scan | built (customer portal spec): `OrderLookup` and `MailPort` with fake/log adapters, env-selected, fake fails closed in production; further ports are design |
| Policy settings | typed, clamped settings with an effective date ("applies to new claims") | B-07, R01, R03, R12 | design (the portal reads the return window and the shipping fee from `EASYRMS_*` variables as a stopgap) |
| Business calendar / SLA | `addBusinessDays`, `dueAt`, `overdue` (clock passed in), `escalateAt` (holiday calendar pluggable) | Q10 2-day target, R04 14 days, Q07 escalation | `addBusinessDays`/`dueAt`/`overdue` built by the agent decision spec (Phase 1); the complaint deadline (14 calendar days) and escalation from day 10 (`complaint-sla.ts`) built by the complaints spec (Phase 1); a holiday calendar is design |
| Evidence requirements | `requirements(facts, product, supplier, rules) → { photos, video, serial, sources[] }`, using the rules engine's `require_evidence` | Z-03, R07, Q14 | design |
| Attachments | upload intent → scan → ready/error; per-type limits (`docs/05` §5.9) | Z-03, K-05 messages, B-03, D-01 | design |
| Identity & permissions | actors `customer`/`agent`/`warehouse`/`supplier`/`system`; permissions (`MANAGE_RULES`, Q05); per-record scope check | every shell | order-scoped guest session built (customer portal spec: signed cookie, CSRF check in `apiHandler`, canonical order number lock); agent authentication built (agent login spec: e-mail + password with scrypt, signed 8 h `easyrms_agent` cookie checked against the database on every request, `proxy.ts`, `authenticate` hook in `apiHandler`/`makeCrudRoute`, agent id on timeline events); the `MANAGE_RULES` permission is the only one and also gates agent management and refunds above the limit; roles beyond `AGENT`, SSO/MFA and other actor types stay design |
| Reference numbers | sequence-backed `PREFIX-YYYY-NNNNN` | `SC-` supplier claims | `formatRma` and `return_rma_seq` built by the agent decision spec; `formatClaimRef` and `supplier_claim_seq` (`SC-YYYY-NNNNN`) built by the complaints spec (Phase 2); other prefixes are design |
| Notifications & templates | template id + variables (`{imie}`, `{rma}`) rendered and sent via `MailPort` | B-02, B-07, status mails | `MailPort` with a log adapter built (customer portal spec); the complaints spec (Phase 2) adds Polish plain-text `renderMail` for the four mail templates, `replyTo`, a `delivers` flag and an SMTP adapter (`EASYRMS_MAIL_TRANSPORT=smtp`); HTML templates and a template editor (B-07) are design |
| Idempotency & rate limiting | idempotency key per mutation; limiter port (in-memory first) | Z-06 submit, K-01/K-04 lookup (R17) | idempotency key on submit and an in-memory limiter class built (customer portal spec); a limiter port and shared store are design |

## Frontend (`ui`; admin = shadcn, public = Tailwind)

| Primitive | Where | Consumers | Status |
|---|---|---|---|
| `FileImport` | `ui/src/admin/forms/` | the lab; later B-03, B-07 | built (case-sample lab spec, PR #26) |
| `StatTile`, `StatRow` | `ui/src/admin/stats/` | the lab, B-06 KPI tiles | built (case-sample lab spec, PR #26) |
| `BreakdownTable` | `ui/src/admin/stats/` | the lab, B-06 "show as table" | built (case-sample lab spec, PR #26) |
| `RuleSummary` | `ui/src/admin/rules/` | the lab, B-05 list, B-02 "applied rules" | built (case-sample lab spec, PR #26) |
| `Stepper`, `StageList` (the tracker; flat in `ui/src/public/`) | `ui/src/public/` | Z-01…Z-06, Z-00, K-05 | built (customer portal spec) |
| Public Tailwind primitives (`Field`, `TextInput`, `Textarea`, `ChoiceGroup`, `Banner`) | `ui/src/public/` | the portal wizard and tracker; later Z-03, K-04 | built (customer portal spec) |
| `Timeline` | `ui/src/admin/timeline/` (public variant in `ui/src/public/`) | B-02, K-05 | admin variant built by the agent decision spec (Phase 2 step 1); the public variant built (customer portal spec) |
| `Inbox` filters + SLA badge | `ui/src/admin/inbox/` | B-01, B-03, B-04, D-01 | design (the agent spec builds a simple inbox in `app`) |
| `RuleBuilder` (drawer) | `ui/src/admin/rules/` | B-05 | design |
| `EvidenceUpload` | `ui/src/public/evidence/` | Z-03, K-05 | design |
| Polish formatting (`formatMoney`, `formatDatePl`, `pluralPl`) | `core` | quote, tracker, timeline, notes | `formatMoney` built (case-sample lab spec, PR #26); the date and plural helpers built (customer portal spec) |

`ui` stays Next-free and has no test runner, so formatting is never done in `ui`: `core`/`app` format money, dates and plurals and pass the strings to components as props.
