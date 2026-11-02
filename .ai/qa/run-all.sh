#!/bin/sh
# Runs every agent-browser QA scenario in .ai/qa/<AREA>/ one after another and prints a summary.
#
#   sh .ai/qa/run-all.sh            # all areas
#   sh .ai/qa/run-all.sh RET CMP    # only these areas
#
# Needs the test environment (.ai/qa/test-env.json, .ai/qa/test-env.env); each scenario starts it on demand.
# Logs go to the gitignored .ai/qa/artifacts_run-all/<ID>.log. Exit code is 1 when any scenario failed.
#
# The limiters (login, lookup, quote, accept) store their windows in the Postgres table `rate_limit_windows`, so they survive
# an app restart. The runner empties that table (TRUNCATE on the local test database, QA-only) before every scenario
# (AGT-002 and RET-005 exhaust limits on purpose, and scenarios finish in seconds) and before retrying a scenario that failed on a 429 / throttle or an
# unhydrated page ("login did not reach the inbox", 'no field labelled "..."'). A real UI regression needs to fail twice.
# Restarting the app before every scenario was tried and made things worse: a cold `next dev` was not hydrated in time.
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
# The limiters keep their windows in the `rate_limit_windows` table (shared Postgres store), so they survive an app restart
# and a failed-lookup lockout from RET-005 would break every later scenario on PL-10001. QA-only escape hatch on the
# disposable local test database (same exception as `db_release_rma`): empty the table instead of waiting out the windows.
reset_throttle() {
  if command -v psql >/dev/null 2>&1; then
    psql "${DATABASE_URL:-postgres://easyrms:easyrms@127.0.0.1:5433/easyrms}" -qtAc "TRUNCATE rate_limit_windows" >/dev/null 2>&1
  else
    (cd "$ROOT" && docker compose exec -T postgres psql -U easyrms -d easyrms -qtAc "TRUNCATE rate_limit_windows" </dev/null >/dev/null 2>&1)
  fi || echo "      warning: could not reset rate_limit_windows; scenarios may hit stale limits"
}
warm
reset_throttle

pass=0; fail=0; failed=""
for area in $AREAS; do
  for f in "$QA_DIR/$area"/"$area"-[0-9][0-9][0-9]-*.sh; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .sh)
    # SET-001 restarts the dev server and truncates its log; keep the log of everything that ran before it.
    case "$id" in SET-*) cp "$QA_DIR/test-env-app.log" "$LOG_DIR/app-before-$id.log" 2>/dev/null || true ;; esac
    start=$(date +%s)
    reset_throttle
    sh "$f" > "$LOG_DIR/$id.log" 2>&1; rc=$?
    if [ "$rc" -ne 0 ] && grep -q -E '429|throttl|login did not reach the inbox|no field labelled' "$LOG_DIR/$id.log"; then
      echo "      $id failed on a rate limiter or an unhydrated page; retrying once after resetting the throttle"; cp "$LOG_DIR/$id.log" "$LOG_DIR/$id.first.log"; reset_throttle
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
