# Checkpoint 2 — Phase 2 (Steps 2.1–2.6)

Targeted validation: `npm run typecheck`, `npm test` (core), `npm run lint` (0 errors), `npm run test:db` (74 tests), `NODE_ENV=production npm run build` (the `ƒ Proxy (Middleware)` entry is present).

`curl` against a dev server and Postgres (no session unless noted):
- Pages `/admin/returns`, `/admin/returns/1`, `/admin/discovery/case-sample` → 307 to `/admin/login?next=<path+query>`.
- `PATCH /api/returns/1`, `POST /api/discovery/case-sample`, `POST /api/agents/logout` → 401 envelope (also before any body is parsed).
- Public stays public: login page, invite page, `/`, `/api/returns/lookup`, `/api/health`.
- Guest cookie (`easyrms_guest` from a real lookup): admin page 307, `PATCH` 401. Garbage agent token: 307. Valid agent cookie: admin pages 200, `PATCH` reaches the service (404 for an unknown id). Agent cookie on the customer portal `/returns`: redirected to `/` (it grants nothing there).
- Production start without `EASYRMS_AGENT_SESSION_SECRET`: a request carrying an agent cookie fails closed (500, only `ConfigurationError` logged); no cookie still redirects; public login page 200.
- Note: after changing `packages/core/src/http` the dev server must be restarted; stale route bundles ran the old `apiHandler` and the guards looked absent (lesson recorded in AGENTS.md).

Browser (agent-browser): protected card URL redirected to login with `next`, login returns to the card, admin header shows the agent and "Wyloguj", approving a return shows "Ula Testowa" on the timeline, logout returns to login and the inbox redirects again. Screenshots `doc/previdences/pr-33/08`, `09`. Dev DB restored afterwards.

Not run here: human QA by a reviewer (risk-high, no self-QA), `audit`, `storybook:build` (final gate).
