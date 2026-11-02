# Issue #81: shared throttle store (autonomous run)

- Scope chosen: first slice of #81 only. MFA (TOTP vs SSO) needs an approved spec, and the audit trail and alerting are separate decisions; none were started.
- Changed: `RateLimiterPort` in `core` (services now `await` it); `PostgresRateLimiter`, `rate_limit_windows` entity and migration `20261102120000` in `db`; `registerDb` registers `rateLimiter`; `app` container and `agent-create` no longer build an in-memory one.
- Tests: `postgres-rate-limiter.test.ts` (limit, reset, release, restart survival, parallel no-overshoot, migration up/down). `npm run test:db`: 104 passed. `core`: 738 passed.
- Environment: `ui`/`app` typecheck, `storybook:build` and `next build` fail in this worktree for environment reasons (missing `@storybook/react`, `nodemailer`; Turbopack root cannot resolve the shared `node_modules`), not from this diff. `db` typechecked with a temp `paths` config (clean). Snapshot `.snapshot-easyrms.json` updated by hand (additions only). `npm run audit` passed.
