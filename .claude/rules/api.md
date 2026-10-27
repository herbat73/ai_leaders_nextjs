---
paths:
  - "packages/app/src/app/api/**"
  - "packages/core/src/http/**"
---
# API conventions

- Every route reuses `packages/core/src/http/`: `apiHandler` maps `AppError`s to a status and the
  `{ ok, data } | { ok: false, error }` envelope and logs unexpected failures; `makeCrudRoute` takes schemas + service
  and returns configured handlers. Routes contain no `try/catch`.
- Keep route handlers thin: delegate to services resolved from the Awilix container (per-request scope for the
  MikroORM `EntityManager` fork). Never `new` a service in a handler and never import a global container into `core`.
- Validate input with the shared Zod schemas from `packages/core/src/validators/<concept>/`.
- Every agent-only route passes `authenticate: requireAgent` to `apiHandler`/`makeCrudRoute`; `proxy.ts` is only the
  optimistic first line.
- Mutations and client-initiated reads reach routes through `apiCall` (`packages/ui/src/admin/api/api-call.ts`, the only
  sanctioned `fetch('/api/*')` site). Do not add Server Actions.
- After changing `packages/core/src/http`, restart `next dev`: route bundles keep the stale `apiHandler`, so a new
  `authenticate` option silently does nothing until you do.
- Routes live at `packages/app/src/app/api/<concept>/route.ts`; read `node_modules/next/dist/docs/` before writing
  Next.js route code.
