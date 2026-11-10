# Run: supplier list filters (#123)

Source doc: .ai/specs/2026-11-10-supplier-list-filters.md

## Goal
`/admin/suppliers` shows 10 suppliers per page with a status dropdown and separate name / e-mail searches (AND), state in the URL, filtering in memory.

## Scope
`core` (`viewSuppliers` + tests), `app` (href helper, copy, filter island, page wiring), QA scenario SUP-004, D15 decision record.

## Non-goals
No API, schema, DI, permission or dependency change; `GET /api/suppliers` stays unpaged; no renaming of `INBOX_PAGE_SIZE`.

## Risks
Low. In-memory filtering must move to SQL if the list reaches the thousands. SUP-004 needs a running app and database; if the environment cannot run it, say so on the PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supplier list filters

- [x] 1.1 core: viewSuppliers with unit tests — 774e8a6
- [x] 1.2 app: supplier-href helper and copy — 3bea157
- [x] 1.3 app: supplier filters island and page wiring — 3bea157
- [x] 1.4 docs and QA: D15 decision record and SUP-004 scenario — a154979
- [ ] 1.5 Full validation gate
