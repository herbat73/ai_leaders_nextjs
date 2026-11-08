#!/bin/sh
# Runs every agent-browser QA scenario in .ai/qa/<AREA>/ one after another and prints a summary.
#
#   sh .ai/qa/run-all.sh            # all areas
#   sh .ai/qa/run-all.sh RET CMP    # only these areas
#
# Needs the test environment (.ai/qa/test-env.json, .ai/qa/test-env.env); each scenario starts it on demand.
# Logs go to the gitignored .ai/qa/artifacts_run-all/<ID>.log. Exit code is 1 when any scenario failed.
#
# Every scenario starts on a fresh database: qa_init (lib/common.sh) drops `easyrms_qa` and clones it from the migrated
# template `easyrms_qa_template` (lib/qa-db.sh), so no rows, held units, agents or rate-limit windows leak between scenarios.
# A scenario that failed on an unhydrated page ("login did not reach the inbox", 'no field labelled "..."') is retried once,
# again on a fresh database; a real UI regression needs to fail twice. A 429 is not retried: on a fresh database it is a bug.
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
QA_DIR="$ROOT/.ai/qa"
LOG_DIR="$QA_DIR/artifacts_run-all"
mkdir -p "$LOG_DIR"

if [ $# -gt 0 ]; then AREAS="$*"; else AREAS=$(cd "$QA_DIR" && ls -d [A-Z][A-Z][A-Z] 2>/dev/null); fi

# The dev server compiles each page on first hit and SET-001 restarts it, so a cold server makes the first scenarios miss
# hydration ("no field labelled ...", "login did not reach the inbox"). Request the pages once before they run.
warm() {
  base=$(sed -n 's/^BASE_URL=//p' "$QA_DIR/test-env.env" 2>/dev/null | tr -d "\"'")
  [ -n "$base" ] || base=$(sed -n 's/.*"baseUrl": *"\([^"]*\)".*/\1/p' "$QA_DIR/test-env.json" 2>/dev/null)
  [ -n "$base" ] || return 0
  for p in /admin/login /admin/returns /admin/lab /admin/suppliers /returns /returns/lookup /returns/new /returns/complaint/new; do
    curl -s -o /dev/null -L --max-time 120 "$base$p" || true
  done
}
# Bring the environment up first: when the running app is not the one on the QA database, test-env-up.sh restarts it, and
# warming the old server would leave the new one cold (the first scenarios then fail on hydration).
sh "$ROOT/.ai/scripts/test-env-up.sh" >/dev/null 2>&1 || { echo "test environment did not start" >&2; exit 2; }
warm

pass=0; fail=0; failed=""
for area in $AREAS; do
  for f in "$QA_DIR/$area"/"$area"-[0-9][0-9][0-9]-*.sh; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .sh)
    # SET-001 restarts the dev server and truncates its log; keep the log of everything that ran before it.
    case "$id" in SET-*) cp "$QA_DIR/test-env-app.log" "$LOG_DIR/app-before-$id.log" 2>/dev/null || true ;; esac
    start=$(date +%s)
    sh "$f" > "$LOG_DIR/$id.log" 2>&1; rc=$?
    if [ "$rc" -ne 0 ] && grep -q -E 'login did not reach the inbox|no field labelled' "$LOG_DIR/$id.log"; then
      echo "      $id failed on an unhydrated page; retrying once on a fresh database"; cp "$LOG_DIR/$id.log" "$LOG_DIR/$id.first.log"
      sh "$f" > "$LOG_DIR/$id.log" 2>&1; rc=$?
    fi
    secs=$(( $(date +%s) - start ))
    if [ "$rc" -eq 0 ]; then
      pass=$((pass + 1)); echo "PASS  $id (${secs}s)"
    else
      fail=$((fail + 1)); failed="$failed $id"; echo "FAIL  $id (${secs}s, rc=$rc): $(grep -m1 '^FAIL' "$LOG_DIR/$id.log")"
    fi
    case "$id" in SET-*) warm ;; esac
  done
done

echo "passed: $pass, failed: $fail (logs: .ai/qa/artifacts_run-all/)"
[ $((pass + fail)) -gt 0 ] || { echo "no scenarios found for: ${AREAS:-<none>}" >&2; exit 2; }
[ "$fail" -eq 0 ] || { echo "failed:$failed"; exit 1; }
