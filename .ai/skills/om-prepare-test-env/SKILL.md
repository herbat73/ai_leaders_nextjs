# Repo-local notes: om-prepare-test-env

- 2026-10-27: `scripts/db.sh` (`npm run db:start`) needs system PostgreSQL binaries and exits silently without them (e.g. macOS with only Docker). `test-env-up.sh` now skips it when port 5433 is already open and otherwise falls back to `docker compose up -d --wait postgres` (same credentials and port). The matching down path is `docker compose stop postgres`. Prevents: the up script dying right after "npm run db:start" with exit 1 and no message.
- 2026-10-27: the agent-browser binary and the descriptor `platform` are chosen per OS and architecture (`uname`), not hardcoded to linux-x64.
