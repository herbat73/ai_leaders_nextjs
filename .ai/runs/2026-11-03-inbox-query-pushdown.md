# Run: admin inbox filtered, ordered and paged in the database

- **Spec:** `.ai/specs/2026-11-03-inbox-query-pushdown.md` (decisions Q1 to Q6 answered by the requester).
- **Changed:** `core` gains `normalizeInboxOptions`, `inboxPageCount`, `inboxInstantRange` (shared with `viewInbox`), `ReturnInboxQuery`/`ReturnInboxPage`, `ReturnRepository.listInbox` and `ReturnService.listInbox`; `db` gains `MikroOrmReturnRepository.listInbox` (count, clamp, escalated-first order, escaped `ILIKE`, instant range) and a shared corrupt-status log; `/admin/returns` calls `listInbox`. `list`, `GET /api/returns` and the customer list are unchanged. No migration.
- **Tests:** core unit tests for the new helpers and the service method. `npm run test:db` (Postgres 17 container on 5433, throwaway schemas): 11 files, 126 tests passed, including the new `return.repository.inbox.test.ts` (19 tests): the SQL order and every filter/paging combination equal `viewInbox` + `complaintEscalated` on the same rows, including the Warsaw clock changes of 2026 (28-29 Mar, 25 Oct), literal `%`, `_`, `\` in search, and the corrupt-status log. Mutation check: changing the escalation `<=` to `<` made 8 of those tests fail; reverted.
- **Measured (step 5):** 10,000 rows in a throwaway schema, median of 7 runs, repository only (the old path also built list items for every row in the service, not counted here):

  | Case | Old (`list` + reorder + `viewInbox`) | New (`listInbox`) |
  |---|---|---|
  | first page, no filter | 107 ms | 2.9 ms |
  | page 100 | 113 ms | 4.1 ms |
  | search `0099` | 106 ms | 5.8 ms |
  | one-month date range | 128 ms | 1.9 ms |

  `EXPLAIN (ANALYZE)`: the page query is a sequential scan with a top-N heapsort (1.8 ms); the count with search is a sequential scan (2.5 ms). At this size no index is needed; revisit with a separate spec if the table reaches the hundreds of thousands.
- **Gate:** typecheck, test (791), `test:db` (126), audit, docs:check and `NODE_ENV=production npm run build` pass. `npm run lint` does not run on this checkout, with or without this change: after `npm ci`, `eslint.config.mjs` fails to import `eslint-config-next/core-web-vitals` because the lockfile resolves `eslint-config-next` to `0.2.4` (since #97). `storybook:build` was not run (no `ui` change).
- **Not done:** the browser QA scenarios (`RET-008` and the PR #73 date/search/paging checks) were not run: `agent-browser` is not installed here. The markup and URLs are unchanged, but the new page is unverified in a browser.
