# Issue #82: logout revokes the agent session (autonomous run, `om-auto-fix-issue`)

- Triage: real and unfixed on `origin/main` a0c6e7d (no PR or commit addressed it; #84 is only the threat-model doc).
- Root cause: `POST /api/agents/logout` only cleared the cookie; `session_epoch` moved only on disable, re-invite and invite-accept, so `AgentService.authenticate` kept accepting a copied token for its 8 hours.
- Changed: `AgentRepository.bumpSessionEpoch` (type in `core`, atomic `update` in `db`), `AgentService.logout`, the logout route calls it, README limits line updated. Behaviour: logout signs the agent out on all devices; a replayed or repeated logout with the old cookie is 401.
- Tests: `agent.service.test.ts` (3 new), `agent.repository.test.ts` (2 new, `test:db`), QA scenario `.ai/qa/AGT/AGT-006-logout-revokes-copied-session.sh` (copied cookie, second device, UI logout and fresh login). AGT-006 failed on the old route (`the copied cookie still works after logout`) and passed on the fix, against a throwaway database `easyrms_qa_82` (dropped afterwards; the shared dev database was not migrated).
- Not done, on purpose: the "permission change invalidates sessions" criterion has no code path today (permissions are set only at invite or re-invite, which already bump the epoch); no password-change endpoint exists. A shorter TTL, idle timeout and manager re-authentication are follow-ups.
- Left alone: the README sentence that the login throttle is in memory per process is stale since #87; it was outside this issue.
