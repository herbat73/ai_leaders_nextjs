# Checkpoint 4 — Phase 4 (Steps 4.1–4.4)

- 4.1 R11: `EASYRMS_REFUND_APPROVAL_LIMIT` (default 2000 PLN). Unit tests: limit allowed, one grosz above refused (403 `approval_required`, nothing written), manager approves, store credit/exchange/legacy never gated, rejecting a large refund not gated, check order note 400 → 404 → 409 → 403 → compare-and-set 409. Live (limit set to 100 on the dev server): plain agent 403, manager 200, decision card shows the approve button disabled with the reason (`doc/previdences/pr-33/18`).
- 4.2 Shared `TrackerBody`: customer tracker before/after is pixel- and text-identical (`19`, `20`).
- 4.3 `/admin/returns/[id]/customer-view`: banner, the same body, no actions, back link only; the agent name never appears in the body (the timeline says "Zespół zwrotów"); unauthenticated 307 to login, unknown id 404 (`21`).
- 4.4 Close-out: brief Q15 answered, D10 and D11 recorded (mirroring the spec, approved 2026-10-24), lessons, db run log, spec moved to `implemented/`.
- Found and fixed while verifying 4.1: `apiHandler` answered an opaque 500 for errors thrown by services of the shared container because `instanceof AppError` fails across Next bundles; `AppError` now carries a `Symbol.for` brand (`isAppError`), with tests.
