# Lessons Learned

This is the long-term memory for AI agents working in this repo. Append an entry here whenever you:

- Fix a non-obvious bug (root cause + fix approach, not just "fixed X")
- Discover a gotcha, footgun, or constraint that isn't obvious from reading the code
- Learn something about this specific "not the Next.js you know" version that cost time to figure out
- Find a better approach after an initial one failed

**Before starting non-trivial work, read this file.** It's cheaper than repeating a mistake someone already made.

For a lesson with enough depth to need code samples, longer explanations, or multiple related findings, write it as its own file in `.ai/lessons/YYYY-MM-DD-slug.md` and link it from an entry here instead of inlining everything.

Keep entries short — a few lines each. Newest entries at the top.

- **2026-10-23 — Customer lookup budgets.** `unavailable` from the order port must consume no limiter budget, so the lookup counter is `check`ed before the port call and `hit` only after a `found`/`not_found` answer (the per-IP and failed-attempt budgets are checked, never pre-consumed). A fresh local DB needs `npm run db:migrate` before routes that read `return_requests` work (a missing table is an opaque 500 `42P01`).

- **2026-10-23 — Idempotency unique violation.** MikroORM's `UniqueConstraintViolationException` has no `constraint` property in this version; match the constraint name in `error.message` (pg: `duplicate key value violates unique constraint "<name>"`), so an RMA collision is not mislabelled as an idempotency conflict.

- **2026-10-23 — Case sample lab (Zod 4, formatting, tests).**
  - `ZodObject.shape[key]` is typed as the bare `$ZodType` in Zod 4, which has no `.safeParse`; use the top-level `safeParse(field, value)` import (here to test whether a column is optional).
  - `Intl` `pl-PL` skips grouping for four-digit numbers (`1299,00 zł`), so `formatMoney` groups by hand with U+00A0 (also before `zł`) and needs no ICU data. Tests must write the non-breaking space as `\u00a0`; a plain space in an expected string fails silently-looking comparisons.
  - Wilson interval checks: assert hand-computed values with the precision the spec states (two digits), not three; 9 of 12 is 0.4677, not 0.467.
  - A stateless feature that must work without Postgres resolves its service from a core-only container (`getCoreContainer()`), not the root one that calls `getOrm()`; verified by running the route with Postgres stopped.

- **2026-10-23 — Agent decision workflow (DB tests, MikroORM, Next, shadcn).**
  - `em.transactional(cb, options)` writes `ctx` (and `propagation`) into the `options` object it receives. A shared constant such as `const JOIN = { propagation: REQUIRED }` carries the first caller's transaction into every later call, and later calls fail with "Transaction is already rolled back". Build the options object fresh per call.
  - The MikroORM CLI loads every `.ts` in `packages/db/src/migrations` (`glob: "!(*.d).{js,ts}"`): a `*.test.ts` there made `npm run db:migrate` crash on `import "vitest"`. Keep tests outside that folder (`src/tests/`). The migrator also rewrites `.snapshot-<database>.json` for whatever database it runs against, so test harnesses must set `migrations.snapshot: false` (a first run overwrote the committed snapshot with a throwaway schema).
  - A per-test Postgres schema: `clientUrl` query parameters are ignored; pass `driverOptions: { options: "-c search_path=<schema>" }` (merged into the `pg` pool options) plus `schema` so unqualified names in raw SQL and migrations resolve inside it.
  - Next bundles `@easyrms/core` once per layer, so `error instanceof NotFoundError` is false for an error thrown through the container into a page. Match on `error.code` (see `admin/returns/[id]/page.tsx`).
  - `npx shadcn@latest add` resolves the `@easyrms/ui/lib/utils` alias wrongly: it writes `import { cn } from "cn"` and adds the npm package `cn` to `packages/ui`. After adding a component, point the import at `../lib/utils` and run `npm uninstall cn -w @easyrms/ui`.

- **2026-10-22 — Storybook in this monorepo.**
  - Pin Storybook ≥ 10.6.2: older versions have critical GHSA-f2ph-cmg5-wxc8, so "pick an older, settled release" picked a vulnerable one. Run `npm run audit` right after installing.
  - `eslint-plugin-storybook`'s `no-renderer-packages` rule fights the "ui is Next-free" rule. It is off for `packages/ui/src/storybook/**` only.
  - TypeScript `**/*.ts` skips dot-directories, so `.storybook/` must be listed in `tsconfig` `include`.
  - Next 16.4.0's `next build` itself aborts (`SecurityFatalError`) when a critical advisory exists for the installed version. A red build can appear with no code change, so check `npm run audit` first.

- **2026-10-21 — `spawnSync("npm", …)` silently fails on Windows.** `npm` is `npm.cmd` there, and Node won't start a `.cmd` without a shell, so `stdout` is `undefined` (`scripts/audit.mjs` then crashed in `JSON.parse`). In Node scripts, run npm as `spawnSync(process.execPath, [process.env.npm_execpath, …])` (set under `npm run`) and check `run.stdout`/`run.error` before parsing.

- **2026-10-21 — Skills in `.claude/skills/` not found on Windows.** The `om-*` / `aa-*` entries in `.claude/skills/` and `.grok/skills/` are git symlinks to `.agents/skills/<name>`. With `core.symlinks=false` (Git for Windows default) they check out as tiny text files holding the target path, so Claude Code sees no `SKILL.md`. Fix: enable Windows Developer Mode, `git config core.symlinks true`, delete the placeholder files and `git checkout --` them again.

## Format

```
## YYYY-MM-DD — short title

What happened / what was learned. Why it matters. Link to `.ai/lessons/...` for details if needed.
```

---

## 2026-10-23 — DB migration tests must pin `migrateUp(target)` once a later migration exists

`migrateDown()` without `to` reverts only the latest migration. Tests of an earlier migration's `down` that call `migrateUp()` (all pending) start undoing the wrong one as soon as a newer migration lands. Always `migrateUp(MIGRATIONS.<that migration>)` in such tests.

## 2026-10-18 — Stray npm in an ancestor `node_modules/.bin` hijacks nested `npm` calls

npm puts every ancestor directory's `node_modules/.bin` on PATH while running a script. A home-folder `C:\Users\<user>\node_modules` that contained npm 6 (a transitive dependency) shadowed the real npm inside scripts. npm 6 ignores `-w`, so the root `db:migrate` (`npm run db:migrate -w @easyrms/db`) called itself recursively and spawned hundreds of processes. Symptom: `npm ERR! code ELIFECYCLE` (npm 6 output) and repeated `"@easyrms/db"` args. Fix: delete the stray shims (`node_modules/.bin/npm*`) above the repo. Also on Windows `spawnSync("npm", …)` fails without `shell: true` (`npm.cmd`).

## 2026-10-14 — `URL.pathname` is not a filesystem path; `gh label list` stops at 30

In a plain Node script, `new URL("..", import.meta.url).pathname` keeps percent-encoding, so a checkout under a path with a space (`My%20Projects`) breaks `spawn` cwd and `fs` calls — use `fileURLToPath`. Also `gh label list` returns only 30 labels by default: a missing-label check against it gave a false "label does not exist" for `risk-low`; pass `--limit 200`. `gh pr review --approve` fails on your own PR; post the verdict as a `--comment` review instead.

## 2026-10-13 — `makeCrudRoute` typing: infer present verbs from config keys, not per-operation generics

Per-operation generics (`TList extends (service: TService) => …`) fail with context-sensitive lambdas (`service => service.list()`): TS falls back to the default and the param becomes `any`. Keep `list`/`remove` plain-typed and infer the key set with `config: Config & { [P in K]: unknown }`. Also: `pkill -f "<pattern>"` inside a Bash command kills the shell running it (the pattern is in its own command line) — kill by PID instead. The `npm audit` baseline was already red (Next < 16.4.0, `braces`) before the gate was added; `braces` has no patched release, so the gate uses `scripts/audit.mjs` with an expiring `audit-allowlist.json` instead of bare `npm audit`.

## 2026-10-13 — Don't mark a spec "Implemented" until its app-side pieces exist

Three phase specs claimed "Implemented" while `packages/app` had no container, routes, Tailwind or pages and `ui` was empty. Verify each spec's Design bullets against the tree (and run the flow against a real DB) before changing status or moving it to `implemented/`.

## 2026-10-13 — `next build` fails with `NODE_ENV=development`; rm of node_modules breaks the live dev server

The sandbox shell sets `NODE_ENV=development`, which makes `next build` crash with `Cannot read properties of null (reading 'useContext')` on `/_global-error`. Build with `NODE_ENV=production`. Also, the preview dev server auto-restarts while `node_modules` is deleted for a reinstall and ends up wedged (500s); kill it and start `npm run dev` again afterwards. `mv`/`git mv` across top-level dirs fails here with "Invalid cross-device link" — use `cp -a` then `rm -rf`.
