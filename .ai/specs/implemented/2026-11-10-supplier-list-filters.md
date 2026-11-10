# Supplier list: pagination, status filter and search

## 📝 TLDR
An agent on `/admin/suppliers` sees every supplier in one unpaged table. This spec proposes (future behavior) 10 rows per page, a status dropdown (all / active / inactive) and two search fields, supplier name and supplier e-mail, each matching a part of the text. It reuses the paging helpers and URL-state pattern of the agent inbox and adds no API, schema or dependency. Source: issue #123.

## Resolved questions (owner answers, 2026-11-10)

| # | Question | Answer |
|---|---|---|
| Q1 | Build now despite D15 (research first)? | Yes, as a small improvement; recorded as a narrow D15 override (see Decisions in play). |
| Q2 | Filter where? | In memory, after `SupplierService.list()`. |
| Q3 | Search | Two fields, name and e-mail, combined with AND when both are filled. |
| Q4 | Status default | All (`Wszyscy`), then `Aktywni`, `Nieaktywni`. |

## 📝 Problem Statement
`admin/suppliers/page.tsx` loads `supplierService.list()` and `SuppliersManager` renders every row. The repository order is "active first, then by name". With many vendors an agent cannot find one by name or e-mail, or hide deactivated ones. Evidence: issue #123 only; no measured supplier count, which is why filtering stays in memory (Q2).

## 📝 Proposed Solution
The page reads `searchParams` (`status`, `name`, `email`, `page`), passes the full list through a pure `viewSuppliers` helper, and renders a filter row above the table plus Previous / Next with "Strona X z Y". Filter state lives in the URL, exactly like the inbox (`inbox-filters.tsx`, `inbox-href.ts`).
Rejected: SQL pushdown (Q2: tens of rows, new repository method for no gain); a client-side-only table (state lost on refresh, hydration cost); paging `GET /api/suppliers` (the claim form on a return reads the whole list for its vendor choice, so that public contract stays unpaged).

## 📝 Architecture
- `core`: new `services/suppliers/supplier-view.ts` with `viewSuppliers(items, {status, name, email, page})` returning `{rows, total, page, pageCount}`, plus unit tests. It reuses `INBOX_PAGE_SIZE` and `inboxPageCount` from `inbox-view.ts` (the names say "inbox"; renaming them would touch the inbox, so the new file imports them and a comment says why). Exported from the `core` index.
- `app`: `admin/suppliers/page.tsx` parses `searchParams` (strings only; `status` validated against `active | inactive`, anything else ignored), calls `viewSuppliers`, passes `view.rows` to `SuppliersManager` and the paging data to the page. New `supplier-filters.tsx` (client island, same shape as `InboxFilters`) and `supplier-href.ts` (the `inboxHref` counterpart) sit next to the page; Polish copy goes into `suppliers/copy.ts`.
- Unchanged: `db`, DI, API routes, permissions (page still agent-guarded, edits still `MANAGE_RULES`), add/edit dialog and toggle.
- Cross-system effect: none outside this screen. The claim form's supplier list and `GET /api/suppliers` are untouched.

## 📝 UI/UX
- Filter row (shadcn, admin only): status `Select` (`Wszyscy` / `Aktywni` / `Nieaktywni`, changing it navigates at once, like the inbox), `Nazwa` input, `E-mail` input, `Szukaj` submit, and `Wyczyść` shown only when a text field is set.
- Header description shows the total and, when filtered, the match count ("Dostawcy: 42, pasuje: 7").
- Empty states: no suppliers at all keeps "Brak dostawców."; filters with no match show "Brak dostawców dla wybranych filtrów."
- Pagination: `nav` with `aria-label`, Previous / Next as links preserving filters, disabled (plain text) at the ends, "Strona X z Y"; hidden when there is one page.
- Accessibility: every control has a visible `Label`; the table keeps its `caption`.
- Lesson applied (2026-10-28, inbox Clear): the island copies URL values into `useState`, so its own clear handler resets those drafts.

## 📝 Edge Cases & Failure Scenarios
- `page` beyond the last page, zero, negative or non-numeric: clamped (1 for bad input, last page when too high).
- Whitespace-only text field: ignored. Search is a case-insensitive substring; e-mail is stored lower-cased, the typed value is lower-cased too.
- Deactivating a supplier while `status=active` (or renaming it out of the search) makes the row vanish after `router.refresh()`; if that empties the current page the clamp moves to the last page. Acceptable and expected; no extra messaging.
- Unknown `status` in the URL: ignored, all shown. `name` or `email` longer than the stored maxima simply match nothing; values are capped at 254 characters before use so a huge query string costs nothing.
- Supplier list read fails: unchanged behavior (the existing page error path), the filters add no new failure source.

## 📝 Risks & Impact Review
Low. No contract, schema or dependency change; nothing that other consumers read. Product direction call: D15 (research-first) is overridden for this one small screen, with the owner's approval, recorded in a decision record; it implies nothing about A01/A04. Scalability limit: in-memory filtering is fine for a vendor directory but must move to SQL if the list reaches the thousands; revisit then.

## 📝 Decisions in play
- **D15** (research first, no new implementation): overridden for #123 only, as D17 was for the rules slice. Owner: Adam Adamczyk, answered Q1 on 2026-11-10. Recorded in `.ai/specs/research/decisions/2026-11-10-supplier-list-filters.md` (Phase 1, step 4).
- No Non-goal or Business rule is touched.

## 📋 Phasing
Single phase: the two filters and paging share one URL contract and ship together.

## 📋 Implementation Plan
Phase 1 (each step leaves the app working):
1. **core** `viewSuppliers` + tests in `supplier-view.test.ts`: status filter, name-only, e-mail-only, both (AND), case-insensitivity, blank text ignored, page clamping (0, negative, too high), exactly 10 per page, order preserved, empty input gives `pageCount` 1. Export from the index.
2. **app** `supplier-href.ts` (empty values and page 1 omitted) with a small test, and `copy.ts` entries (filters, "no match" message, pagination, description with match count).
3. **app** `supplier-filters.tsx` and wiring in `admin/suppliers/page.tsx` (`searchParams`, `viewSuppliers`, pagination nav). Typecheck and lint pass; manual look at `/admin/suppliers`.
4. **docs and QA**: decision record for the D15 override; QA scenario `.ai/qa/SUP/SUP-004-supplier-list-filters.{md,sh,ps1}` (seed 12+ suppliers through `POST /api/suppliers`, assert 10 on page 1 and 2 on page 2, status filter, name fragment, e-mail fragment, both fields, Wyczyść, deactivate under the active filter); add a lesson only if something non-obvious appears.
5. Run the gate: `lint`, `typecheck`, `test`, `audit`, `docs:check`, `storybook:build`.

## 🔍 Review notes (author self-review)
- Scope cohesion: one capability (list narrowing on one screen). The skill asks for a fresh-context reviewer for this item; none was spawned in this run, so this is the author's own read and a human or `om-auto-review-pr` pass should confirm it.
- Canonical mechanisms: reuses inbox paging, URL helper pattern, `apiCall`/router refresh for mutations, shadcn components; no Server Actions.
- Testability: every step has a unit test, a typecheck, or the SUP-004 scenario.
- Market check: vendor lists in Shopify/Odoo-style back offices use one search box plus a status filter; the two-field AND search is the owner's choice (Q3) and costs one extra input, so no complexity is carried that needs cutting.
