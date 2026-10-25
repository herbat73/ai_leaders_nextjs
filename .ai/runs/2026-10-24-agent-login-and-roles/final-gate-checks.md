# Final gate — agent-login-and-roles

All commands from `validation.commands`, in order, on the final tree:

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | pass, 576 core tests |
| `npm run lint` | pass, 0 errors (86 warnings, all pre-existing files) |
| `npm run audit` | pass, no blocking high/critical advisories |
| `npm run docs:check` | pass (41 components, 10 guide pages, no raw colours) |
| `npm run storybook:build` | pass; the changed `CrudForm` docs page and the new `PasswordField` story load in a headless browser with no console errors |
| `NODE_ENV=production npm run build` | pass; `ƒ Proxy (Middleware)`, `/admin/agents`, `/admin/returns/[id]/customer-view` in the route table |
| `npm run test:db` (not in the gate until CI has Postgres) | pass, 75 tests; see `.ai/runs/2026-10-24-agent-login-and-roles-db-run.md` |

Integration suite (`om-integration-tests`): skipped. The repository has no integration or e2e runner (`app` and `ui` have no test runner, AGENTS.md); the stand-in is the `curl` and browser verification recorded in `checkpoint-1..4-checks.md` with screenshots in `doc/previdences/pr-33/`.

Design-system pass: `docs:check` and `storybook:build` are the repo's tooling and are green; the new screens use only `@easyrms/ui/admin` components and semantic tokens.

Not done by this run (by design): human QA by a reviewer (risk-high, no self-QA), the security review of the login before public deployment, the finance reviewer's acceptance of the R11 limit, adding `check:guards` to the gate (separate owner approval).
