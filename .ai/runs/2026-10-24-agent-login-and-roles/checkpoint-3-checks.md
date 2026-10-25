# Checkpoint 3 — Phase 3 (Steps 3.1–3.3)

Targeted validation: typecheck, `npm test` (558 core tests), lint (0 errors), docs:check. The disable concurrency test (two managers racing, exactly one wins) is the Step 1.4 repository test in `test:db`.

`curl` (dev server, Postgres): no session 401; plain agent 403 `forbidden` on list, invite and disable; manager list returns no credentials; invite returns the token once (201) and a mail log line `agent_invite` with a masked address; active e-mail 409; bad body 400 field errors; disable: self 409 `self_disable`, bad id 400, unknown 404, success bumps the epoch and the disabled agent's cookie is rejected on the next request; re-inviting a disabled e-mail works and ends its sessions.

Browser (agent-browser, screenshots `doc/previdences/pr-33/10..17`): agents list with "Agenci" nav link only for `MANAGE_RULES`, invite dialog with validation, one-time link with copy button and the shown-once warning, disable confirmation, row marked "Wyłączony", and a non-manager sees the "Brak uprawnień" page. The last-manager disabled-with-reason state is implemented but cannot be reached by a manager through the UI (a manager acting on another manager always leaves two); it is covered by the repository tests.

Dev note: Turbopack HMR served a stale `AdminShell` after an edit (no "Agenci" link until `next dev` was restarted); recorded as a lesson. Dev DB cleaned afterwards.
