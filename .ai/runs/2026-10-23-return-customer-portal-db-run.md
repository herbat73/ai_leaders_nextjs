# Return customer portal: scripted Postgres run

Started 2026-10-23T20:52:58.934Z. Scratch database `easyrms_portal_e2e`, app (`next dev`, fake order source) on port 3112.

## Setup
- ✅ migrations applied on the scratch database — return_request_events,return_request_items,return_requests
- ✅ production build

## Lookup
- ✅ wrong e-mail is a neutral 404 — 404 We could not find an order matching these details
- ✅ wrong order is the same 404 with the same message — 404
- ✅ no cookie on a miss
- ✅ case/space variant resolves to the canonical order number — PL-10001
- ✅ session cookie is HttpOnly + SameSite=Lax — easyrms_guest=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200
- ✅ lines returned — 3
- ✅ undelivered order gives trackingUrl and no cookie — https://tracking.example.pl/przesylka/PL10004
- ✅ sessions for two more delivered orders

## Quote
- ✅ 401 without a session — 401
- ✅ 400 with fieldErrors for a bad line — {"items.L9":"not_returnable"}
- ✅ refund by courier = 349,99 - 12,50 fee — {"amountMinor":33749,"feeMinor":1250,"currency":"PLN","amountText":"337,49 zł","feeText":"12,50 zł"}
- ✅ refund to store drop-off has no fee — {"amountMinor":34999,"feeMinor":0,"currency":"PLN","amountText":"349,99 zł","feeText":"0,00 zł"}
- ✅ store credit adds the 10% bonus and has no fee (349,99 -> 384,99) — {"amountMinor":38499,"feeMinor":0,"currency":"PLN","amountText":"384,99 zł","feeText":"0,00 zł"}
- ✅ exchange has no amount — {"amountMinor":null,"feeMinor":null,"currency":"PLN","amountText":null,"feeText":null}

## Submit
- ✅ 401 without a session — 401
- ✅ 201 with RMA and the server-computed amount — 201 RMA-2026-00001
- ✅ replay of the same key is 200 with the same RMA — 200
- ✅ over-quantity is 400 — {"items.L2":"already_claimed"}
- ✅ a line already claimed is 400 already_claimed — {"items.L1":"already_claimed"}
- ✅ 8 concurrent submits for one line: exactly one 201, the rest 409 (in-lock re-check) or 400 already_claimed (pre-lock check) — 201,400,400,409,409,409,409,409
- ✅ exactly one request stored for the raced line — 1
- ✅ one submitted event for the raced request — 1
- ✅ first order accepts the key — 201
- ✅ the same key from another order is a mapped 4xx, never 500 — 409 conflict
- ✅ DELETE session clears the cookie — easyrms_guest=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
- ✅ mutation without the CSRF header is 403 csrf_rejected — 403 csrf_rejected
- ✅ submit without the CSRF header is 403 — 403

## Agent side
- ✅ agent inbox lists the new request — RMA-2026-00001 submitted
- ✅ agent PATCH submitted -> approved is 200 — 200
- ✅ the mock status mail was sent (logged, masked recipient) — mail not sent (mock adapter) { template: 'return_status_changed', to: 'a***@example.pl' }
- ✅ the full customer address is never logged
- ✅ an invalid agent move is still 409 — 409

## Rate limit
- ✅ 429 once the 10-per-minute IP budget is spent — 200,404,404,200,429 (6 earlier lookups, so the 429 comes at lookup 11)

Scratch database dropped, dev server stopped.

**Result: all checks passed.** Finished 2026-10-23T20:53:11.818Z.

## Database suite

`npm run test:db` (Vitest in `@easyrms/db`, Postgres 17 on localhost:5433, one throwaway schema per file): 4 files, 52 tests passed, three consecutive runs. New file `packages/db/src/tests/customer-portal-concurrency.test.ts` (separate forks/connections, a 150 ms pause inside the lock):

- ✅ two submits for one order line: one request, one `ConflictError`, serialised (the second enters only after the first leaves); six racers: one winner
- ✅ different orders do not block each other (two 150 ms pauses overlap)
- ✅ the same idempotency key from two orders: one row and a `ConflictError`, also when both race under different locks
- ✅ the advisory lock key is `hashtext` of exactly the order number passed in (read from `pg_locks`)
- ✅ a case/space variant (`pl-10001`, `  Pl-10001 `) through the real `ReturnService` and repository: every lock key, stored value and comparison is `PL-10001` (S8); a matching flow test in core asserts the same against the fake repository

Notes: the HTTP race sends eight concurrent submits; the losers answer 409 (in-lock re-check) or 400 `already_claimed` (arrived after the winner committed), exactly one 201 and one stored row. Run with `next dev` because the fake order source fails closed in production; the production build is checked separately.
