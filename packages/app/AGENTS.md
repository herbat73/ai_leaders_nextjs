<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# `@easyrms/app`

The only package with Next.js routes and the only composition root (`src/server/container.ts`, Awilix). Prefer Server
Components; add `"use client"` only when needed. Keep route handlers thin.

- **Admin pages:** every page calls `requireAgentPage(path)` and renders inside `AdminShell`. Every agent-only API
  route passes `authenticate: requireAgent` to `apiHandler`/`makeCrudRoute` (`src/proxy.ts` is only the optimistic first
  line). Both live in `src/server/agent-auth.ts`.
- **Customer pages** use plain Tailwind and the order-scoped guest session (`src/server/guest-session.ts`).
- **DI:** register new services explicitly in `src/server/container.ts`; request-bound state (the MikroORM
  `EntityManager` fork) is per-request scope.
- **Internal packages** ship TypeScript source; `next.config.ts` lists them in `transpilePackages`. Add any new internal
  package there.
- After changing `packages/core/src/http`, restart `next dev`: route bundles keep the stale `apiHandler`, so a new
  `authenticate` option silently does nothing until you do.
- Storybook config is in `.storybook/`; stories themselves live in `packages/ui/src/storybook/`. `app` has no test
  runner yet.
- Build with `NODE_ENV=production npm run build` (a shell with `NODE_ENV=development` fails prerendering
  `/_global-error`).
