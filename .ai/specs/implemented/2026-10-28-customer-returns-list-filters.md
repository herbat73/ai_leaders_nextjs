# Customer returns list: pagination, status filter and search

## 📝 TLDR
A customer on `/returns` sees every return and complaint of their order in one unpaged list. This spec proposes (future behavior) 10 rows per page, a status dropdown, a search by part of the RMA number and a submission date range (from / to). It reuses the filtering and paging that the agent inbox got in PR #73 and adds no API, schema or dependency. Source: issue #75.

## Resolved assumptions (autonomous defaults)

| # | Question | Chosen answer | Rationale |
|---|---|---|---|
| Q1 | Filter in the database or in memory? | In memory, after `returnService.listForOrder`. | The list is scoped to one order, so it is small; no new repository method, API route or contract. Same approach as the inbox. |
| Q2 | Client island or plain form? | Plain `GET` form in a Server Component, state in the URL (`status`, `q`, `from`, `to`, `page`). | Works without JS and keeps the public side on Tailwind only; no client state to reset (see the 2026-10-28 Clear lesson). |
| Q3 | Reuse `viewInbox`? | Yes: add an optional `status` to `InboxViewOptions` in `core`, keep the name and defaults. | One filtering implementation; existing admin behavior unchanged when `status` is absent. |
| Q4 | Page size | 10 (`INBOX_PAGE_SIZE`), as the issue states. | Issue requirement. |
| Q5 | Date semantics | Inclusive `YYYY-MM-DD` days of `createdAt` in Europe/Warsaw; malformed values ignored. | Identical to the inbox. |
| Q6 | Which statuses in the dropdown? | All `StoredReturnStatus` values with the customer labels from `_lib/status-labels.ts`. | Reuses existing copy; no hidden statuses. |
| Q7 | Show filters on a short list? | Always show them. | Simplest; hiding by count adds a rule to explain. |

No assumption carries `⚠ NEEDS HUMAN CONFIRMATION`.

## 📝 Problem Statement
`packages/app/src/app/returns/page.tsx` renders all requests of the session order. An order with many partial returns and complaints becomes long and hard to scan; the customer cannot find one RMA or see only open cases.

## 📝 Proposed Solution
Make `/returns` read `searchParams` and pass the order's requests through `viewInbox`, now accepting `status`. The page renders a filter form above the list, the current page of rows, and Previous / Next links with "Page X of Y". Alternatives rejected: a client-side table (adds hydration state, needs a library or hand-written code), a new API route (the page is a Server Component read, which the repo's data-flow rule already covers).

## 📝 Architecture
- `core`: `viewInbox` gains `status?: StoredReturnStatus`; unit tests extended in `inbox-view.test.ts`.
- `app`: `returns/page.tsx` parses `searchParams` (strings only, `status` validated against `RETURN_STATUSES` plus `unknown`; an unknown value is ignored), `returns/_components/` gets a `list-filters.tsx` server component and `returns/_lib/list-href.ts` (the customer counterpart of `inboxHref`), copy added to `returns/copy.ts`.
- No change to `db`, `ui`, API routes, DI or the session check (the order still comes only from the guest session; filters never widen scope).

## 📝 UI/UX
- Filter row (Tailwind, labelled inputs): status `<select>` with "Wszystkie statusy", RMA text input, "Od" and "Do" date inputs, "Szukaj" submit and "Wyczyść" link to `/returns`.
- Empty states: no requests at all keeps "Nie masz jeszcze zgłoszeń"; filters with no match show "Brak zgłoszeń dla wybranych filtrów".
- Pagination: Previous / Next links preserving the filters, hidden when there is one page; the current page is clamped by `viewInbox`.
- Accessibility: every control has a visible label, the list keeps `aria-label`, pagination is a `nav` with `aria-label`, links carry `aria-disabled` rather than disappearing mid-range.

## 📝 Edge Cases & Failure Scenarios
- `page` beyond the last page or non-numeric: clamped to a valid page.
- `from` later than `to`: empty result with the "no match" message.
- Invalid status or malformed date in the URL: ignored, full list shown.
- Search is case-insensitive substring on the RMA only; it never touches other customers' data because the input list is already session-scoped.

## 📝 Risks & Impact Review
Low. No contract, schema or dependency changes; `viewInbox` stays backward compatible (new optional field). The only shared surface touched is the admin inbox helper, covered by its existing tests.

## 📋 Phasing
Single phase; the three filters and paging ship together because they share the URL contract.

## 📋 Implementation Plan
1. **core**: add `status` to `viewInbox` with tests (status match, combined with search/date, absent status unchanged). App still works.
2. **app**: `list-href.ts` + `copy.ts` entries + `list-filters.tsx`; wire into `returns/page.tsx` with `searchParams`. Typecheck and lint pass.
3. **QA**: add an `.ai/qa/RET/` scenario (customer with more than 10 requests: page count, status filter, RMA fragment, date range, clear) and a lesson if anything non-obvious appears.
4. Run the full gate (`lint`, `typecheck`, `test`, `audit`, `docs:check`, `storybook:build`).
