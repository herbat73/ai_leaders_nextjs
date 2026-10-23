# Platform primitives (map, non-binding)

Source: `.ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md` (written there, moved here after its architectural review of 2026-10-23). Taken from UC-01…UC-15, screens K/Z/B/D/X and the API catalog (`docs/05`) via the product brief.

Primitives marked **design** are **non-binding proposals**: a sketch of the contract, built and approved by the first spec that needs it (YAGNI, `doc/engineering-standards.md` §4). Listing one here does not approve it. The spec that needs it starts from the sketch and may change it, but should not build a parallel mechanism. "Built by" rows are kept in step with the specs that build them; when a spec lands, update its row.

## Backend (`core`; persistence in `db`)

| Primitive | Contract sketch | Consumers in the backlog | Status |
|---|---|---|---|
| Rules engine | closed, provisional `Condition`/`Action` vocabulary, `evaluate`, `simulate`, `withThresholds`, `describeRule` | UC-09, UC-14/B-05, R07 evidence, R10 routing | built by the case-sample lab spec |
| `ClaimKind`, `ProductCategory`, `ClaimFacts` | normalized rule input: kind, value, categories; later + reasons, days since delivery, supplier | rules, eligibility (UC-02…05), quote (Z-04) | built by the case-sample lab spec (the portal defines its own order and quote types, not `ClaimFacts`) |
| `Money` | integer minor units, `PLN` only for now; parse (pl/en), compare, `multiplyMoney(m, qty)`, format pl-PL | quote, R11 limits, refunds, supplier notes, analytics | parse/compare/format/`multiplyMoney` built by the case-sample lab spec (Phase 1 step 1); `addMoney`, `applyRate` by the customer portal spec |
| Metrics | `share` (Wilson 95%), `median`, `percentile`, `groupBy` over plain rows | B-06, #15 KPI baselines, the lab report | built by the case-sample lab spec |
| Tabular import | `parseTable(text, rowSchema, { maxRows, cellGuard }) → rows \| errors[{ line, column, message }], droppedColumns` | the lab; later bulk import / B2B (N01) | built by the case-sample lab spec |
| State machine | `defineStateMachine({ states, transitions, guards }) → { can, assert, next, allowed }`; throws `ConflictError` | claims (9 statuses), supplier claims DRAFT→SENT→ACCEPTED/REJECTED→CREDITED, uploads | built by the agent decision spec (Phase 1) |
| Domain events + timeline | `DomainEvent { id: "concept.entity.action", aggregateId, actor, at, payload }`; one typed in-process emitter; timeline = events projected per aggregate | K-05, B-02, R11 audit, mail triggers | design (the agent spec keeps a per-concept `return_request_events` table instead) |
| Ports & adapters | `<Name>Port` + mock adapter, env-selected, fail closed in production | carrier, payments, vouchers, AV scan | pattern built by the customer portal spec (`OrderLookup`, `MailPort` with fake/mock adapters, production guard); further ports are design |
| Policy settings | typed, clamped settings with an effective date ("applies to new claims") | B-07, R01, R03, R12 | design (the portal reads the return window and the shipping fee from `EASYRMS_*` variables as a stopgap) |
| Business calendar / SLA | `addBusinessDays`, `dueAt`, `overdue` (clock passed in), `escalateAt` (holiday calendar pluggable) | Q10 2-day target, R04 14 days, Q07 escalation | `addBusinessDays`/`dueAt`/`overdue` built by the agent decision spec (Phase 1); SLA escalation is design |
| Evidence requirements | `requirements(facts, product, supplier, rules) → { photos, video, serial, sources[] }`, using the rules engine's `require_evidence` | Z-03, R07, Q14 | design |
| Attachments | upload intent → scan → ready/error; per-type limits (`docs/05` §5.9) | Z-03, K-05 messages, B-03, D-01 | design |
| Identity & permissions | actors `customer`/`agent`/`warehouse`/`supplier`/`system`; permissions (`MANAGE_RULES`, Q05); per-record scope check | every shell | order-scoped guest session built by the customer portal spec; agent authentication and roles are design and a recorded blocker for public deployment |
| Reference numbers | sequence-backed `PREFIX-YYYY-NNNNN` | `SC-` supplier claims | `formatRma` and `return_rma_seq` built by the agent decision spec; other prefixes are design |
| Notifications & templates | template id + variables (`{imie}`, `{rma}`) rendered and sent via `MailPort` | B-02, B-07, status mails | `MailPort` with a mock adapter built by the customer portal spec; template rendering is design |
| Idempotency & rate limiting | idempotency key per mutation; limiter port (in-memory first) | Z-06 submit, K-01/K-04 lookup (R17) | idempotency key on submit and an in-memory limiter class built by the customer portal spec; a limiter port and shared store are design |

## Frontend (`ui`; admin = shadcn, public = Tailwind)

| Primitive | Where | Consumers | Status |
|---|---|---|---|
| `FileImport` | `ui/src/admin/forms/` | the lab; later B-03, B-07 | built by the case-sample lab spec |
| `StatTile`, `StatRow` | `ui/src/admin/stats/` | the lab, B-06 KPI tiles | built by the case-sample lab spec |
| `BreakdownTable` | `ui/src/admin/stats/` | the lab, B-06 "show as table" | built by the case-sample lab spec |
| `RuleSummary` | `ui/src/admin/rules/` | the lab, B-05 list, B-02 "applied rules" | built by the case-sample lab spec |
| `Stepper`, `StageList` (the tracker; flat in `ui/src/public/`) | `ui/src/public/` | Z-01…Z-06, Z-00, K-05 | planned in the customer portal spec (Phase 2) |
| Public Tailwind primitives (`Field`, `TextInput`, `Textarea`, `ChoiceGroup`, `Banner`) | `ui/src/public/` | the portal wizard and tracker; later Z-03, K-04 | planned in the customer portal spec (Phase 2) |
| `Timeline` | `ui/src/admin/timeline/` (public variant in `ui/src/public/`) | B-02, K-05 | planned in the agent decision spec (Phase 2) and the portal spec |
| `Inbox` filters + SLA badge | `ui/src/admin/inbox/` | B-01, B-03, B-04, D-01 | design (the agent spec builds a simple inbox in `app`) |
| `RuleBuilder` (drawer) | `ui/src/admin/rules/` | B-05 | design |
| `EvidenceUpload` | `ui/src/public/evidence/` | Z-03, K-05 | design |
| Polish formatting (`formatMoney`, `formatDatePl`, `pluralPl`) | `core` | quote, tracker, timeline, notes | `formatMoney` by the case-sample lab spec; the date and plural helpers by the customer portal spec |

`ui` stays Next-free and has no test runner, so formatting is never done in `ui`: `core`/`app` format money, dates and plurals and pass the strings to components as props.
