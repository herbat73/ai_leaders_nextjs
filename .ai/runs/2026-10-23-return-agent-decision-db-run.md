# Return agent decision: scripted Postgres run

Started 2026-10-23T18:41:05.954Z. Scratch database `easyrms_e2e`, app on port 3111.

## Migration
- ✅ initial migration applied (legacy schema) — [migrator] Applied 'Migration20261013164552'
Seeded 100008 legacy rows (100000 generated, 8 named: every legacy status, a corrupt one, two rows tied at 31 Dec 23:30 UTC).
- ✅ agent decision migration applied
- ✅ status mapping — submitted,resolved,approved,rejected,received,weird
- ✅ every backfilled RMA equals formatRma(seq, created_at) in created_at, id order (100008 rows)
- ✅ tie broken by id, year taken in Europe/Warsaw (31 Dec 23:30 UTC is 2027) — RMA-2027-100007, RMA-2027-100008
- ✅ sequence past 99999 is not truncated (no lpad) — RMA-2027-100008
- ✅ one synthesized submitted event per row

## App routes
- ✅ production build
- ✅ GET ?status=received lists one row with its shape
- ✅ GET ?status=unknown lists the corrupt row with no actions
- ✅ GET ?status=bogus is 400
- ✅ PATCH submitted → approved is 200
- ✅ the move wrote one event next to the creation event
- ✅ PATCH approved → rejected is 409 carrying the stored status
- ✅ the refused move wrote no event
- ✅ reject with 29 characters is 400 under decisionNote
- ✅ reject with 30 characters is 200
- ✅ a note with any status but approved/rejected is 400
- ✅ later moves leave the decision note unchanged (P6) — Item was used and returned late.
- ✅ PATCH on an unknown-status row is 409
- ✅ PATCH on an unknown id is 404
- ✅ two concurrent moves: one 200, one 409 — 200/409
- ✅ the loser's 409 carries the winner's status
- ✅ exactly one event for the race (plus creation) — events=2
- ✅ POST creates a submitted request with the next RMA — RMA-2026-100009
- ➖ the portal's transaction-scoped create is not checked yet (its PR A has not landed)

## Rollback
- ✅ down refuses after agent use
- ✅ down changed nothing

**Result: all checks passed.** Finished 2026-10-23T18:41:16.440Z.

## Database suite

`npm run test:db` (Vitest in `@easyrms/db`, Postgres 17 on localhost:5433, one throwaway schema per file): 2 files, 28 tests passed, three consecutive runs (the two-agent race is repeated 18 times without a second event).
