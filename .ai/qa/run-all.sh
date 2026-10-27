#!/bin/sh
# Runs every agent-browser QA scenario in .ai/qa/<AREA>/ one after another and prints a summary.
#
#   sh .ai/qa/run-all.sh            # all areas
#   sh .ai/qa/run-all.sh RET CMP    # only these areas
#
# Needs the test environment (.ai/qa/test-env.json, .ai/qa/test-env.env); each scenario starts it on demand.
# Logs go to the gitignored .ai/qa/artifacts_run-all/<ID>.log. Exit code is 1 when any scenario failed.
#
# Pauses keep the run under the app's rate limiters (see .ai/lessons.md):
#   AGT-002 uses 9 of the 10 agent logins a minute; RET-004/005 drain the order-lookup limiter.
# Those fixed pauses are not enough on their own (five agent logins in a row still exceed 10 a minute), so a
# scenario that fails on a 429 / throttle is retried once after the same pause. PAUSE=<seconds> overrides it.
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
QA_DIR="$ROOT/.ai/qa"
LOG_DIR="$QA_DIR/artifacts_run-all"
PAUSE=${PAUSE:-75}
mkdir -p "$LOG_DIR"

if [ $# -gt 0 ]; then AREAS="$*"; else AREAS=$(cd "$QA_DIR" && ls -d [A-Z][A-Z][A-Z] 2>/dev/null); fi

pass=0; fail=0; failed=""
for area in $AREAS; do
  for f in "$QA_DIR/$area"/"$area"-[0-9][0-9][0-9]-*.sh; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .sh)
    start=$(date +%s)
    sh "$f" > "$LOG_DIR/$id.log" 2>&1; rc=$?
    if [ "$rc" -ne 0 ] && grep -q -E '429|throttl' "$LOG_DIR/$id.log"; then
      echo "      $id hit a rate limiter; retrying once after ${PAUSE}s"; sleep "$PAUSE"
      sh "$f" > "$LOG_DIR/$id.log" 2>&1; rc=$?
    fi
    secs=$(( $(date +%s) - start ))
    if [ "$rc" -eq 0 ]; then
      pass=$((pass + 1)); echo "PASS  $id (${secs}s)"
    else
      fail=$((fail + 1)); failed="$failed $id"; echo "FAIL  $id (${secs}s, rc=$rc): $(grep -m1 '^FAIL' "$LOG_DIR/$id.log")"
    fi
    case "$id" in
      AGT-002-*|RET-005-*) echo "      pause ${PAUSE}s (rate limiters)"; sleep "$PAUSE" ;;
    esac
  done
done

echo "passed: $pass, failed: $fail (logs: .ai/qa/artifacts_run-all/)"
[ $((pass + fail)) -gt 0 ] || { echo "no scenarios found for: ${AREAS:-<none>}" >&2; exit 2; }
[ "$fail" -eq 0 ] || { echo "failed:$failed"; exit 1; }
