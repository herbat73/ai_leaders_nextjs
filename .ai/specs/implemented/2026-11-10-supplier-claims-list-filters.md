# Supplier claims list: pagination, status dropdown, search and date range

## 📝 TLDR
An agent on `/admin/supplier-claims` ("Reklamacje do dostawców") sees every claim in one unpaged table with a row of status buttons and no search. This spec proposes (future behavior) 10 rows per page, a status dropdown, and three searches: a number (claim `SC-…` or customer case `RMA-…`, part of it), a created-date range (from / to) and the supplier name (part of it). It reuses the paging helpers and URL-state pattern of the inbox and the supplier list and adds no API, schema or dependency. Source: issue #124.

## Resolved questions (owner answers, 2026-11-10)

| # | Question | Answer |
|---|---|---|
| Q1 | Build now despite D15 (research first)? | Yes, a third narrow override (after #123 and D17), recorded as a decision record. |
| Q2 | What does "request number" match? | Either the claim number (`ref`) or the customer case number (`rma`), in one field. |
| Q3 | Which date does the range filter? | `createdAt`, day read in Europe/Warsaw (same as the inbox). |
| Q4 | Filter where? | In memory, after `SupplierClaimService.list()`. |
| Q5 | Status control | Replace the six status buttons with a dropdown; `?status=` URL and the `unknown` value keep working. |

## 📝 Problem Statement
`admin/supplier-claims/page.tsx` loads `supplierClaimService.list({status?})` and renders every row in a `DataTable`; the only narrowing is the status buttons. With many claims an agent cannot find one by number or supplier, or look at a period. Evidence: issue #124 only; no measured claim count, which is why filtering stays in memory (Q4).

## 📝 Proposed Solution
The page reads `searchParams` (`status`, `q`, `supplier`, `from`, `to`, `page`), keeps passing a valid `status` to the existing `list({status})` (the repository already filters it), and passes the result through a pure `viewSupplierClaims` helper for number, supplier, date range and the page cut. A client filter island sits above the table; Previous / Next with "Strona X z Y" sits below. State lives in the URL, as in the inbox and `/admin/suppliers`.
Rejected: SQL pushdown (Q4: only complaints that reach a vendor become claims; no new repository method for no measured gain); paging `GET /api/supplier-claims` (it stays unpaged, a public contract); keeping the status buttons next to a dropdown (Q5, two controls for one filter).

## 📝 Architecture
- `core`: new `services/supplier-claims/claim-view.ts` with `viewSupplierClaims(items, {q, supplier, from, to, page})` returning `{rows, total, page, pageCount}`, plus unit tests. It reuses `INBOX_PAGE_SIZE`, `inboxPageCount` and `normalizeInboxOptions({from, to, page})` from `returns/inbox-view.ts` (only its date and page results are used; its single `search` field does not fit two text fields, so number and supplier are trimmed, lower-cased and capped at 254 characters in the new helper), and needs that file's private `warsawDay` exported (an additive one-word change; a comment in the new file says why it imports from "inbox"). Exported from the `core` index. Status is not part of the helper: it stays on the repository filter.
- `app`: `admin/supplier-claims/page.tsx` parses `searchParams` (strings only; `status` validated by the existing `supplierClaimListQuerySchema`, invalid keeps today's "Nieznany status w filtrze" message), calls `viewSupplierClaims`, renders the filter island and the pagination nav. New `claim-filters.tsx` (client island, same shape as `SupplierFilters`) and `claim-href.ts` (the `supplierHref` counterpart) sit next to the page; Polish copy goes into `supplier-claims/copy.ts`.
- Unchanged: `db`, DI, API routes and their schemas, permissions (page stays agent-guarded), the claim detail page, and the claim section on a return.
- Cross-system effect: none outside this screen.

## 📝 UI/UX
- Filter row (shadcn, admin only): status `Select` (`Wszystkie` plus the six values with the existing `statusLabels`; changing it navigates at once, like the inbox), `Numer` input (placeholder "Część numeru reklamacji lub zgłoszenia"), `Dostawca` input, `Od` and `Do` date inputs (`from` capped by `to` and the reverse), `Szukaj` submit, `Wyczyść` shown only when a text or date field is set.
- Header description shows the total and, when narrowed, the match count ("Liczba reklamacji do dostawców: 42, pasuje: 7").
- Empty states: no claims at all keeps "Brak reklamacji do dostawców."; filters with no match show "Brak reklamacji dla wybranych filtrów." (the status-only "w tym statusie" text is replaced).
- Pagination: `nav` with `aria-label`, Previous / Next as links preserving filters, plain disabled text at the ends, "Strona X z Y"; hidden for one page.
- Accessibility: every control has a visible `Label`; the table keeps its caption (via `DataTable`).
- Lesson applied (2026-10-28, inbox Clear): the island copies URL values into `useState`, so its own clear handler resets those drafts.

## 📝 Edge Cases & Failure Scenarios
- `page` beyond the last page, zero, negative or non-numeric: clamped (1 for bad input, last page when too high).
- Number or supplier text that is whitespace only: ignored. Matching is case-insensitive substring; `q` matches `ref` or `rma`, `supplier` matches `supplierName`. Values are capped at 254 characters before use.
- A repeated query parameter (`?q=a&q=b`, an array in `searchParams`) is ignored, as on `/admin/suppliers`: only a single string is read.
- The table's `emptyMessage` shows the "no match" text when any filter (status, number, supplier, date) is active, not only status.
- Malformed `from` / `to` (not `YYYY-MM-DD`): ignored, as in the inbox. `from` later than `to`: no rows match and the empty state says so; the date inputs' `min`/`max` discourage it in the browser.
- Day boundaries: a claim created at 23:30 on the night before a DST change is placed by its Warsaw day, same as the inbox (`warsawDay`).
- Unknown `status` in the URL: filter ignored, all shown, with the existing message. Stored status `unknown` stays selectable.
- A claim moves out of the current status filter after an action on its detail page; the list is re-read on navigation (`force-dynamic`), so no stale row.
- Supplier claim list read fails: unchanged page error path; the filters add no new failure source.

## 📝 Risks & Impact Review
Low. No contract, schema or dependency change; `GET /api/supplier-claims` and its schema are untouched. Product direction call: D15 (research first) is overridden for this one screen, with the owner's approval (Q1), recorded in a decision record; it implies nothing about A01 or A04. One evidenced coupling: the new helper imports names that say "inbox"; accepted to keep one page size and one date rule rather than rename across the inbox. Scalability limit: in-memory filtering suits tens to low hundreds of claims; move to SQL (like the inbox, 2026-11-03) if the list grows into the thousands. Rollback: revert the PR; no data changes.

## 📝 Decisions in play
- **D15** (research first, no new implementation): overridden for #124 only, as for #123 and D17. Owner: Adam Adamczyk, answered Q1 on 2026-11-10. Recorded in `.ai/specs/research/decisions/2026-11-10-supplier-claims-list-filters.md` (Phase 1, step 4).
- No Non-goal or Business rule is touched.

## 📋 Phasing
Single phase: status, searches, date range and paging share one URL contract and ship together.

## 📋 Implementation Plan
Phase 1 (each step leaves the app working):
1. **core** export `warsawDay` from `inbox-view.ts`; add `viewSupplierClaims` + `claim-view.test.ts`: number matches `ref`, number matches `rma`, supplier fragment, both (AND), case-insensitivity, blank text ignored, from-only, to-only, both (inclusive), malformed date ignored, Warsaw-day boundary (around a DST change), page clamping (0, negative, too high), exactly 10 per page, order preserved, empty input gives `pageCount` 1. Export from the index.
2. **app** `claim-href.ts` (empty values and page 1 omitted; keeps `status`; the app package has no test runner, so SUP-005 covers it) and `copy.ts` entries (filters, status dropdown "Wszystkie", no-match message, pagination, description with match count).
3. **app** `claim-filters.tsx` and wiring in `admin/supplier-claims/page.tsx` (`searchParams`, `viewSupplierClaims`, pagination nav; status buttons removed). Typecheck and lint pass; manual look at `/admin/supplier-claims`.
4. **docs and QA**: decision record for the D15 override; QA scenario `.ai/qa/SUP/SUP-005-supplier-claims-list-filters.{md,sh,ps1}` (seed 12+ claims, assert 10 on page 1 and 2 on page 2, status dropdown, claim-number fragment, RMA fragment, supplier fragment, date range including an empty range, Wyczyść); a lesson only if something non-obvious appears.
5. Run the gate: `lint`, `typecheck`, `test`, `audit`, `docs:check`, `storybook:build`.
