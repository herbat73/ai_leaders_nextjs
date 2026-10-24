#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-10-24 generated: wraps the repo's own db:start / db:migrate / next dev (no docker on this host)
#   2026-10-24 portable port_open (node) instead of bash-only /dev/tcp
#   2026-10-24 repair: attach to a healthy dev server already on the port (fixes "Another next dev server is already running")
set -eu

# ---- project-specific variables ------------------------------------------------
ROOT=$(cd "$(dirname "$0")/.." && cd .. && pwd)
QA_DIR="$ROOT/.ai/qa"
DESCRIPTOR="$QA_DIR/test-env.json"
LOCK_DIR="$QA_DIR/test-env.lock"
CACHE_FILE="$QA_DIR/test-env-build-cache.json"
LOG_FILE="$QA_DIR/test-env-app.log"
PID_FILE="$QA_DIR/test-env-app.pid"
PREFERRED_PORT=3000
HEALTH_PATH=/api/health
DB_PORT=5433                                  # scripts/db.sh default (EASYRMS_DB_PORT)
PREP_CMD="npm install"                        # skipped while the fingerprint matches
MIGRATE_CMD="npm run db:migrate"
FINGERPRINT_INPUTS="package-lock.json package.json packages/db/src/migrations"
ARTIFACTS="node_modules"
TTL="${TEST_ENV_CACHE_TTL_SECONDS:-600}"
BROWSER_BIN_GLOB="$HOME/.cache/agent-tools/agent-browser/v0.35.2/agent-browser-linux-x64"
# ---------------------------------------------------------------------------------

FORCE=0; FORCE_REBUILD=0
for a in "$@"; do
  case "$a" in --force) FORCE=1 ;; --force-rebuild) FORCE_REBUILD=1 ;; esac
done

cd "$ROOT"
mkdir -p "$QA_DIR"
now() { date -u +%FT%TZ; }
epoch() { date +%s; }
START_EPOCH=$(epoch)

probe() { curl -fsS --max-time 5 "$1" >/dev/null 2>&1; }

pid_alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
port_open() { node -e 'require("net").connect({host:"127.0.0.1",port:+process.argv[1]}).on("connect",()=>process.exit(0)).on("error",()=>process.exit(1))' "$1"; }

# ---- lock --------------------------------------------------------------------
acquire_lock() {
  i=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    owner=$(sed -n 's/.*"pid": *\([0-9]*\).*/\1/p' "$LOCK_DIR/owner.json" 2>/dev/null || true)
    if ! pid_alive "$owner"; then rm -rf "$LOCK_DIR"; continue; fi
    i=$((i + 1)); [ "$i" -gt 150 ] && { echo "lock wait timed out" >&2; exit 1; }
    sleep 2
  done
  printf '{"pid": %s, "source": "test-env-up.sh", "acquiredAt": "%s"}\n' "$$" "$(now)" > "$LOCK_DIR/owner.json"
}
release_lock() { rm -rf "$LOCK_DIR"; }
acquire_lock
trap release_lock EXIT INT TERM

# ---- reuse check ---------------------------------------------------------------
json_field() { sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$DESCRIPTOR" | head -1; }

if [ "$FORCE" = 0 ] && [ -f "$DESCRIPTOR" ] && [ "$(json_field status)" = running ]; then
  BASE=$(json_field baseUrl); APP_PID=$(json_field pid); STARTED=$(json_field startedAtEpoch)
  fresh=0
  if [ -n "$STARTED" ] && [ $(( $(epoch) - STARTED )) -le "$TTL" ]; then fresh=1; fi
  # a source file newer than the descriptor invalidates reuse
  if [ "$fresh" = 1 ] && [ -n "$(find packages -path '*/node_modules' -prune -o -path '*/.next' -prune -o -path '*/storybook-static' -prune -o -type f -newer "$DESCRIPTOR" -print -quit 2>/dev/null)" ]; then fresh=0; fi
  if { [ "$APP_PID" = 0 ] || pid_alive "$APP_PID"; } && [ "$fresh" = 1 ] && probe "$BASE/" && probe "$BASE$HEALTH_PATH"; then
    echo "TEST_ENV_STATUS=running"
    echo "TEST_ENV_BASE_URL=$BASE"
    echo "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
    echo "TEST_ENV_REUSED=1"
    echo "BROWSER_PROVIDER=agent-browser"
    echo "BROWSER_INSTALLED=1"
    # keep the environment alive: release the lock without stopping the app
    exit 0
  fi
  echo "stale environment; tearing down what this repo started" >&2
  sh "$ROOT/.ai/scripts/test-env-down.sh" || true
fi

# ---- build cache ---------------------------------------------------------------
fingerprint() {
  { for f in $FINGERPRINT_INPUTS; do
      if [ -d "$f" ]; then find "$f" -type f | sort | while read -r x; do cksum < "$x"; done
      elif [ -f "$f" ]; then cksum < "$f"; fi
    done; echo "root=$ROOT node=$(node -v)"; } | cksum | awk '{print $1":"$2}'
}
FP=$(fingerprint)
CACHED=$(sed -n 's/.*"fingerprint": *"\([^"]*\)".*/\1/p' "$CACHE_FILE" 2>/dev/null || true)
if [ "$FORCE_REBUILD" = 0 ] && [ "$FP" = "$CACHED" ] && [ -d "$ARTIFACTS" ]; then
  echo "build cache hit ($FP): skipping $PREP_CMD"
else
  echo "build cache miss: $PREP_CMD"
  sh -c "$PREP_CMD"
  printf '{"fingerprint": "%s", "root": "%s", "at": "%s"}\n' "$FP" "$ROOT" "$(now)" > "$CACHE_FILE"
fi

# ---- services: repo's own local postgres + migrations ---------------------------
DB_STARTED_BY_US=0
if ! port_open "$DB_PORT"; then DB_STARTED_BY_US=1; fi
npm run db:start
sh -c "$MIGRATE_CMD"

# ---- app start + health wait ------------------------------------------------------
free_port() {
  node -e 's=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}
OWNED=1
if probe "http://localhost:$PREFERRED_PORT$HEALTH_PATH"; then
  # A healthy dev server this script did not start (a developer's own): attach, never stop it.
  OWNED=0; PORT=$PREFERRED_PORT; BASE="http://localhost:$PORT"; APP_PID=0
  START_CMD="(attached to existing server on port $PORT)"
  echo "attaching to existing healthy server at $BASE"
else
  if port_open "$PREFERRED_PORT"; then PORT=$(free_port); else PORT=$PREFERRED_PORT; fi
  BASE="http://127.0.0.1:$PORT"
  START_CMD="npm run dev -w @easyrms/app -- -H 127.0.0.1 -p $PORT"
  : > "$LOG_FILE"
  nohup sh -c "exec $START_CMD" >> "$LOG_FILE" 2>&1 &
  APP_PID=$!
  echo "$APP_PID" > "$PID_FILE"
  i=0
  until probe "$BASE$HEALTH_PATH"; do
    i=$((i + 1))
    if ! pid_alive "$APP_PID" || [ "$i" -gt 90 ]; then echo "app failed to become healthy; see $LOG_FILE" >&2; tail -20 "$LOG_FILE" >&2; exit 1; fi
    sleep 2
  done
fi
probe "$BASE/" || { echo "app shell not reachable" >&2; exit 1; }
# ---- descriptor ------------------------------------------------------------------
BROWSER_VERSION=$("$BROWSER_BIN_GLOB" --version 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%d-%H%M%S)-$$"
NOW_EPOCH=$(epoch)
cat > "$DESCRIPTOR" <<EOF
{
  "version": 1,
  "runId": "$RUN_ID",
  "status": "running",
  "mode": "discovered",
  "baseUrl": "$BASE",
  "startedByThisRepo": $([ "$OWNED" = 1 ] && echo true || echo false),
  "startScript": ".ai/scripts/test-env-up.sh",
  "stopScript": ".ai/scripts/test-env-down.sh",
  "app": { "startCommand": "$START_CMD", "port": $PORT, "healthPath": "$HEALTH_PATH", "pid": $APP_PID },
  "services": [
    { "type": "postgres", "host": "127.0.0.1", "port": $DB_PORT, "container": "", "startedByThisRun": $DB_STARTED_BY_US, "env": {} }
  ],
  "credentials": [],
  "browser": {
    "provider": "agent-browser",
    "installed": true,
    "command": "$BROWSER_BIN_GLOB",
    "version": "$BROWSER_VERSION",
    "descriptor": ".ai/browsers/agent-browser.md",
    "notes": ""
  },
  "testRunner": { "name": "none", "config": "" },
  "platform": "linux",
  "startedAt": "$(now)",
  "startedAtEpoch": $NOW_EPOCH,
  "notes": "next dev against local postgres (npm run db:start; migrations applied). Customer portal uses the in-memory fake order adapter (seeded orders); there is no login: admin pages are unauthenticated. Teardown: sh .ai/scripts/test-env-down.sh (stops the dev server; leaves postgres running unless this run started it)."
}
EOF

echo "TEST_ENV_STATUS=running"
echo "TEST_ENV_BASE_URL=$BASE"
echo "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
echo "TEST_ENV_REUSED=0"
echo "BROWSER_PROVIDER=agent-browser"
echo "BROWSER_INSTALLED=1"
echo "elapsed=$(( $(epoch) - START_EPOCH ))s"
