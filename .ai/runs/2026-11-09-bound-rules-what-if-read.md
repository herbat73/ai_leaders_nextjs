# Run log: bound the rules what-if read in the database (#119)

Issue #119 (follow-up of #118): `RulesService.simulateRules` loaded every request through the unpaged `ReturnRepository.list()` and capped only afterwards.

## Change
- `core`: `ReturnListOptions { limit? }` and `list(filter?, options?)` on `ReturnRepository` (additive, optional second argument; `ReturnListFilter` and the public unpaged `list()` unchanged). `RulesService` asks for `MAX_SIMULATED_REQUESTS + 1` rows, so `truncated` still means "more than the cap".
- `db`: `MikroOrmReturnRepository.list` applies `limit` (newest first). No schema change, no migration.

## Tests
- `rules.service.test.ts`: the service asks for cap + 1; exactly the cap is not truncated, one above is.
- `return.repository.test.ts` (db): limit keeps the newest rows, combines with the filter, `limit: 0` is empty, no limit returns all.

## Outcome
- `npm run test:db`: 12 files, 134 tests passed (local PostgreSQL, 2026-11-09).
- Gate: see the PR.
