# Database tests

Back to the [README](./README.md); for the local database see [GettingStarted.md](./GettingStarted.md).

`npm run test:db` runs Vitest in `@easyrms/db` against the local PostgreSQL from `npm run db:start` (or the database in `EASYRMS_DATABASE_URL`). Every test file creates a throwaway schema (selected through `search_path`) and drops it afterwards, so your data is untouched. It covers the migrations (status mapping, RMA backfill order, `down` refusal, the items table) and the repository (compare-and-set transitions, events, concurrent submits under the order lock). It is not part of `npm test` or the CI gate until CI has a Postgres service, so record its result in `.ai/runs/` for each PR that touches `packages/db`.
