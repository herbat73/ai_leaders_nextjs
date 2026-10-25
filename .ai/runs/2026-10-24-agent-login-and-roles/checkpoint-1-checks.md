# Checkpoint 1 — Phase 1 (Steps 1.1–1.8)

Targeted validation (all green): `npm run typecheck`, `npm test` (507 core tests), `npm run lint` (0 errors; warnings pre-existing), `npm run docs:check`, `npm run test:db` (72 tests, incl. the new agent migration and repository tests: single-use invite under concurrency, duplicate first invite 409, last-manager race).

Live checks against local Postgres (dev server on :3100):
- `curl`: login before accept 401 `invalid_credentials`; bad token 400 `invite_invalid`; short password 400 validation; accept 200 + `easyrms_agent` cookie (HttpOnly, SameSite=Lax, 8 h); second accept 400; login 200; logout clears cookie; 4 wrong logins 401 then 429, and the right password is also 429 while throttled; unknown e-mail costs a real hash (~0.22 s, same as a wrong password).
- `npm run agent:create` prints a working one-time link; invalid arguments exit non-zero.
- Browser (agent-browser): login page, client validation, neutral error, invite page (short password, show/hide), accept → `/admin/returns`, reused link → neutral alert, signed-in agent opening `/admin/login?next=//evil.example` is redirected to `/admin/returns`. Screenshots: `doc/previdences/pr-33/01..07`.

Not yet run at this checkpoint: `audit`, `storybook:build`, production `build` (final gate).
