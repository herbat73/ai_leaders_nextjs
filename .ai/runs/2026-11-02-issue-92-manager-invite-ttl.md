# Run: issue #92 — shorter manager invites and accepted-at (T-08)

- **Route:** `om-auto-fix-issue 92` (security fix chain), isolated worktree, branch `fix/issue-92-manager-invite-ttl`.
- **Changed:** `AgentService` takes `inviteConfig` (`EASYRMS_MANAGER_INVITE_TTL_HOURS`, default 8, 0.25 to 72; plain agents keep 72 h); migration `Migration20261102130000` adds `agents.accepted_at`; `consumeInvite` sets it, `reinvite` clears it; `/admin/agents` shows the expiry of an open invite and the accept time; `agent:create` prints the expiry; README documents the variable.
- **Tests:** core unit tests (TTL by permission, expired manager invite vs live plain one, accepted-at set and cleared, config parsing, referrer header in `next.config.ts`); `npm run test:db` (db package, local Postgres on 5433): 10 files, 107 tests passed, including the new `consumeInvite` / `reinvite` accepted-at test.
- **Gate:** typecheck, test (781), lint (0 errors), audit, docs:check, storybook:build, `NODE_ENV=production npm run build` passed.
- **Not done:** no `.ai/qa` scenario (an expired link needs a wait of at least 15 minutes or a clock hook the QA environment lacks); the `/admin/agents` column was not looked at in a browser.
- **Trap found:** raw `em.execute` rows return `timestamptz` as driver text (`"2026-11-02 10:00:00+00"`), not `Date`; the repository now returns ISO text via `to_char` and converts it.
