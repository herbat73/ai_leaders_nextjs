# Admin returns inbox: filter, order and page in the database

## 📝 TLDR
The agent inbox (`/admin/returns`) loads every return and complaint from Postgres on each request, then searches, date-filters, orders escalated complaints first and cuts a page of 10 in memory. This spec proposes (future behavior) doing all of that in one repository query, so a request reads one page plus a count, with the same results, ordering and URL contract as today. Origin: the performance review of `packages/app` (follow-up to PR #98).

## Resolved assumptions
Answered by the requester ("go with all recommended"); none is an autonomous default.

| # | Question | Decision |
|---|---|---|
| Q1 | Customer list `/returns` | Out of scope: stays on in-memory `viewInbox` (one order's rows, small). |
| Q2 | Escalated-first ordering | Exact parity with the TypeScript rule (Q07), computed in SQL with `AT TIME ZONE 'Europe/Warsaw'` and proven by a DST test. |
| Q3 | Search and indexes | `ILIKE '%q%'` with escaped wildcards; no new index, extension or migration. |
| Q4 | `GET /api/returns` | Unchanged (`returnService.list` and `ReturnRepository.list` stay); the page uses a new, separate method. |
| Q5 | Page out of range | Two queries per request (count, then page) so the page can be clamped. |
| Q6 | Corrupt statuses | The "unknown status" error is logged for the returned page's rows only; the `unknown` filter still lists all of them. |

## 📝 Problem Statement
`packages/app/src/app/admin/returns/page.tsx` calls `returnService.list({ status, kind })`. Status and kind are already filtered in SQL (`MikroOrmReturnRepository.list`), but everything else is not:

- the repository returns **all** matching rows, maps each to a domain object, and `ReturnService.list` builds a `ReturnListItem` (due date, overdue flag, allowed transitions, complaint SLA fields) for **every** one;
- the page then moves escalated complaints first (two `filter` passes), and `viewInbox` (`core/src/services/returns/inbox-view.ts`) applies the RMA search, the Warsaw-day `from`/`to` range and `INBOX_PAGE_SIZE = 10` in JavaScript.

Cost per request grows linearly with the table: rows read, hydrated and decorated, for ten shown. Evidence is the code read in the review; there are no production measurements (Phase 1 step 5 adds a local measurement).

## 📝 Proposed Solution
A new repository method `listInbox(query)` returns `{ rows, total, page, pageCount }` for one page, ordered `escalated desc, created_at desc, id desc`. A new service method `ReturnService.listInbox(query)` normalizes the query, passes the clock, and builds list items only for the page. The admin page keeps parsing `searchParams` and swaps its data call; the rendered output and the URL contract (`status`, `kind`, `q`, `from`, `to`, `page`) do not change.

Alternatives rejected: caching the full list per process (stale data, shared mutable state); cursor paging (the UI has numbered pages and `?page=N` links); a materialized "escalated" column (a schema change and a job to keep it current, for a rule that is a pure function of two existing columns and the clock).

## 📝 Architecture
- `core` (pure, no I/O):
  - `types.ts`: `ReturnInboxQuery` (`status?`, `kind?`, `search?`, `from?`, `to?`, `page`, `pageSize`, `now`, `escalationDays`) and `ReturnInboxPage` (`rows: ReturnRequest[]`, `total`, `page`, `pageCount`); `ReturnRepository.listInbox(query)` joins the port. `ReturnRepository.list` stays for `GET /api/returns`.
  - `inbox-view.ts`: extract the existing normalization (trim and lowercase the search, accept only `YYYY-MM-DD` dates, clamp the page) into an exported pure function used by both `viewInbox` and the new service method, so the two code paths cannot drift.
  - `return.service.ts`: `listInbox(options: InboxViewOptions & { kind? })` returns `InboxView<ReturnListItem>`, the type the page already renders.
- `db`: `MikroOrmReturnRepository.listInbox`. All SQL stays here (persistence rule). The Warsaw date range is converted in TypeScript to a half-open instant range (`created_at >= start(from)`, `created_at < start(to + 1 day)`) with the existing `warsawWallClockToInstant`, so it needs no SQL time-zone arithmetic. Only the escalated ordering uses SQL time-zone arithmetic (below).
- `app`: `admin/returns/page.tsx` replaces `list` + reorder + `viewInbox` with one `returnService.listInbox(...)` call. `returns/page.tsx` (customer) is untouched.
- No new dependency, no DI registration (the service and repository are already registered), no route, no migration.

## 📝 Data Model
No schema change (Q3). The query reads `return_requests` (`created_at` is `timestamptz`); the existing indexes (`order_number`, unique `rma`) are not used by the inbox filters. The follow-up decision "add an index on `(created_at, id)` / `status`" is made from the step-5 measurement, not now.

## 📝 Query semantics
All of these must equal today's behavior; the db tests assert each against the TypeScript reference (`viewInbox`, `complaintEscalated`).

| Concern | Rule |
|---|---|
| Status | As today: a known status matches equality; `unknown` matches `status NOT IN (known)`. |
| Kind | Equality, as today. |
| Search | Trimmed, case-insensitive substring of `rma`: `rma ILIKE '%' || escaped || '%' ESCAPE '\'`, where `\`, `%` and `_` in the input are escaped. Empty after trim: no condition. |
| Date range | Inclusive Warsaw days. `from` -> `created_at >= instant of 00:00 Warsaw on from`; `to` -> `created_at < instant of 00:00 Warsaw on (to + 1 day)`. Malformed values ignored. `from > to` yields an empty page. |
| Escalated | `kind = 'complaint' AND status = 'submitted' AND ((created_at AT TIME ZONE 'Europe/Warsaw') + escalationDays * interval '1 day') AT TIME ZONE 'Europe/Warsaw' <= now`. `escalationDays` and `now` are parameters (`COMPLAINT_ESCALATION_DAY` and the service clock), not constants in `db`. |
| Order | `escalated DESC, created_at DESC, id DESC` (total order, so pages are stable). |
| Paging | `count(*)` of the filtered set, `pageCount = max(1, ceil(total / pageSize))`, `page` clamped into `1..pageCount`, then `LIMIT pageSize OFFSET (page - 1) * pageSize`. |

The TypeScript rule resolves a repeated wall-clock reading to the later instant (`warsawWallClockToInstant`), and Postgres may resolve the overlap or gap hour differently. The parity test (Phase 1 step 2) covers the Warsaw DST change days (2026-03-29 and 2026-10-25) at the hour boundaries. If Postgres and TypeScript disagree on those hours, the spec's answer to Q2 still stands: adjust the SQL expression until they match, and record the case in `.ai/lessons.md`.

## 📝 API Contracts
None change. `GET /api/returns` keeps returning the whole filtered list through `returnService.list` (Q4); the new method is internal to the `/admin/returns` Server Component. Not a protected surface in `BACKWARD_COMPATIBILITY.md`.

## 📝 UI/UX
No visible change: same rows, same order, same pagination links and messages. The one visible-adjacent difference is that the displayed total is the database count of the filtered set (same number as before).

## 📝 Edge Cases & Failure Scenarios
- `page` below 1, non-numeric or beyond the last page: clamped (a count query comes first).
- Empty result: `rows = []`, `total = 0`, `page = 1`, `pageCount = 1`; the page shows the existing empty message.
- `q` containing `%`, `_` or `\`: matched literally, never as a wildcard.
- A request inserted or moved between the count and the page query can make one page one row off; the inbox is a live view and the next load is consistent. No transaction is added.
- Corrupt stored status: the row is returned with status `unknown` and logged once per request if it is on the returned page (Q6); it is no longer logged when it is off the page.
- Database error: unchanged (opaque 500 via the framework; no new error type).

## 📝 Risks & Impact Review
- **Reversibility:** high. No schema, contract or dependency change; revert the commit and the old path (`list` + `viewInbox`) still exists, because `list` and `viewInbox` are kept.
- **Behavior drift** is the real risk: three rules move from TypeScript to SQL (search, date range, escalation). Mitigated by running both implementations over the same fixtures in the db tests (see Testing), not by trust.
- **Search cost:** `ILIKE '%q%'` still scans the filtered rows (Q3, accepted); the win is that it scans in the database without hydrating them.
- **Duplicate rule:** the escalation rule now exists in TypeScript (`complaintEscalated`, used for the badge) and in SQL (ordering). The parity test is what keeps them from diverging; a comment at both places names the other.
- No sensitive-data change: the same columns are read, and `customer_email` is still only shown to authenticated agents.

## 📝 Testing
- `core` (runs in the gate): unit tests for the extracted normalization (search trim/case, malformed dates, page clamp) and for `ReturnService.listInbox` with a fake repository (list items built only for returned rows; clock passed through; `total`/`page`/`pageCount` forwarded). `viewInbox` tests stay green unchanged.
- `db` (`npm run test:db`, outside the gate; record the result in `.ai/runs/`): on a throwaway schema, seed returns and complaints around the escalation boundary and DST days, then assert
  - result and order equal the TypeScript reference (`complaintEscalated` + `viewInbox` over `list()`) for a matrix of status, kind, search, `from`/`to`, page;
  - literal matching of `%`, `_`, `\` in search;
  - page clamping and the empty result;
  - the `unknown` status filter and the once-per-page corrupt-status log.
- QA (agent-browser): re-run the existing inbox scenarios (`RET-008-inbox-filters-by-status`, and the date/search/paging checks from PR #73) against the new path; add a scenario only if none covers escalated-first plus paging together.

## 📋 Phasing
Single phase. The pieces share one contract (the query) and each step below leaves the app working; the app is switched over only in step 4.

## 📋 Implementation Plan
1. **core: types and shared normalization.** Add `ReturnInboxQuery`, `ReturnInboxPage` and `ReturnRepository.listInbox`; extract the normalization out of `viewInbox` and use it there. Unit tests for the extracted function. Nothing calls the new port yet; `typecheck` and `npm test` pass. (If the db package fails typecheck because the port gained a method, add a throwing stub in step 1 and replace it in step 2, or land steps 1 and 2 in one commit.)
2. **db: `MikroOrmReturnRepository.listInbox`.** Implement the semantics table (count, clamp, ordered page, escaped `ILIKE`, instant range, escalated expression with `escalationDays`/`now` parameters), reuse the existing row mapper and the corrupt-status log for the page rows. Add the db tests above, including the DST parity cases; run `npm run db:start` and `npm run test:db`; write the run to `.ai/runs/2026-11-03-inbox-query-pushdown.md`.
3. **core: `ReturnService.listInbox`.** Normalize, call the port with `this.clock()` and `COMPLAINT_ESCALATION_DAY`, build list items for the page only. Unit tests with a fake repository.
4. **app: switch the page.** In `admin/returns/page.tsx` replace `list` + the escalated reorder + `viewInbox` with `returnService.listInbox`; keep `returnListQuerySchema` parsing, `inboxHref`, the invalid-filter message and all markup. `typecheck` and `lint` pass; open `/admin/returns` locally and compare with the previous branch for the same URLs.
5. **Measure and QA.** Seed about 10,000 returns locally (QA database only), record request time and `EXPLAIN (ANALYZE)` of the count and page queries before (`main`) and after in the PR description; decide from the numbers whether an index follow-up is needed (a new spec, not part of this one). Run the existing inbox QA scenarios; add a lesson if anything non-obvious appeared.
6. **Gate.** `lint`, `typecheck`, `test`, `audit`, `docs:check`, `storybook:build`, and `NODE_ENV=production npm run build`. Move this spec to `.ai/specs/implemented/` when the PR merges.

## 🔍 Review
Checked against the `om-spec-writing` lens:
- **Scope cohesion:** one capability (inbox query), no bundled work; the customer list and any index are explicitly separate.
- **Contracts:** no protected surface changes; the port gains a method, existing methods are kept.
- **Boundaries:** SQL only in `db`; `core` stays pure (clock, `escalationDays` and `pageSize` are passed in); the app resolves the service from the existing container; no Server Action, no new route.
- **Reversibility and failure modes:** covered above; the main residual risk is rule drift, which the parity tests exist to catch.
- **Not examined:** actual query plans and timings (no data yet, step 5), the MikroORM v7 API for a raw ordering expression (confirm in step 2; if `orderBy` cannot take a raw expression, use the `QueryBuilder` for this one method).
