# `@easyrms/core`

Framework-agnostic business logic: services, validators, rules engine, state machine, money/metrics/tabular helpers and
the shared HTTP layer.

- Imports nothing internal and never React, Next.js, MikroORM or a global container.
- Shared Zod schemas live in `src/validators/<concept>/`, services in `src/services/<concept>/<name>.service.ts`.
- `src/http/` (`apiHandler`, `makeCrudRoute`) is used by every API route. Routes contain no `try/catch`; responses use
  the `{ ok, data } | { ok: false, error }` envelope. Restart `next dev` after changing it. Route rules:
  `.claude/rules/api.md`.
- Tests: `npm test` runs Vitest here (`src/**/*.test.ts`, pure unit tests, no database or React).
- Before adding a rules/money/state-machine/port primitive, check `doc/platform-primitives.md`.
