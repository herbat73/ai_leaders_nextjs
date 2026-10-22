# EasyRMS code review checklist

Standards: `doc/engineering-standards.md`. Severity in parentheses.

## Structure and conventions

- Concept folder naming matches the standards; entity, repository and service exist as a set. (major)
- No import breaks the dependency direction (`app → ui, core, db`; `db → core` types only). (blocker)
- New routes use `makeCrudRoute`/`apiHandler` (no hand-rolled `try/catch`); client calls use `apiCall`; forms use
  `CrudForm`; lists use `DataTable`. A bespoke version needs a stated reason in the PR. (major)
- No Server Actions for mutations. (major)
- Services are registered explicitly in Awilix; none instantiated with `new` in routes or components. (major)
- Schema changes ship as a MikroORM migration. (blocker)
- `npm run lint`, `typecheck`, `test`, `audit`, and `NODE_ENV=production npm run build` pass. (blocker)

## Security

- [ ] A write endpoint parses an explicit Zod shape; the raw body never reaches `em.create()`/`em.assign()`. (blocker)
- [ ] No secret, token, password or JWT in a log, error response or client payload. (blocker)
- [ ] No untrusted input reaches a query, shell command or file path unparameterized. (blocker)
- [ ] Security decisions fail closed on unexpected errors. (blocker)
- [ ] Auth enforced server-side on every non-public route; ownership checked per record (once auth exists). (blocker)
- [ ] Check-then-act on shared state is protected by a transaction and/or unique constraint. (blocker)
- [ ] Cookie flags preserved when auth-cookie code is touched; rate limiting on login/register/reset. (major)
- [ ] A security bug fix ships a regression test that fails without the fix. (major)

## Correctness and tests

- A behavior change ships a test that fails on the old code; a bug fix ships a regression test.
- Anything client-supplied that affects money or ownership is revalidated server-side.
- Concurrent flows are covered by a test of the concurrent case, not just the happy path.
