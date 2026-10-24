#!/bin/sh
# om-prepare-test-env: generated teardown (contract v2) - safe to run twice
# history:
#   2026-10-24 generated
set -eu
ROOT=$(cd "$(dirname "$0")/.." && cd .. && pwd)
QA_DIR="$ROOT/.ai/qa"
DESCRIPTOR="$QA_DIR/test-env.json"
PID_FILE="$QA_DIR/test-env-app.pid"

[ -f "$DESCRIPTOR" ] || { echo "no descriptor; nothing to stop"; exit 0; }
grep -q '"startedByThisRepo": true' "$DESCRIPTOR" || { echo "environment not started by this repo; leaving it"; exit 0; }

PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  # the dev server runs as a process group leader's child tree: stop children first
  pkill -P "$PID" 2>/dev/null || true
  kill "$PID" 2>/dev/null || true
  i=0; while kill -0 "$PID" 2>/dev/null && [ "$i" -lt 10 ]; do sleep 1; i=$((i + 1)); done
  kill -9 "$PID" 2>/dev/null || true
fi
rm -f "$PID_FILE"

# stop postgres only when the up script started it
if grep -q '"startedByThisRun": 1' "$DESCRIPTOR"; then
  (cd "$ROOT" && npm run db:stop) || true
fi

sed 's/"status": "running"/"status": "stopped"/' "$DESCRIPTOR" > "$DESCRIPTOR.tmp" && mv "$DESCRIPTOR.tmp" "$DESCRIPTOR"
echo "TEST_ENV_STATUS=stopped"
