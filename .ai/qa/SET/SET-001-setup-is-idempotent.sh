#!/bin/sh
# SET-001: `npm run setup` can be re-run safely: it exits 0, reports each step as done or skipped, and points at `npm run dev`.
# Scenario: .ai/qa/SET/SET-001-setup-is-idempotent.md
# Priority: Low. Type: CLI (no browser). Role: developer on a prepared checkout (dependencies installed, database reachable).
# Runs the installer twice and compares: the second run must skip every step except the preflight. It does not touch the
# test environment, so there is nothing to clean up. The negative paths (missing PostgreSQL binaries, port taken) need a
# machine without those tools and are not simulated here.
set -eu
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$ROOT"
fail() { echo "FAIL: $1" >&2; exit 1; }
run_setup() { npm run setup </dev/null 2>&1; }

echo "-- first run"
FIRST=$(run_setup) || fail "npm run setup exited non-zero: $FIRST"
echo "$FIRST" | grep -q '^Next: npm run dev' || fail "no \"Next: npm run dev\" line after the first run"
echo "$FIRST" | grep -q '✖' && fail "a step failed in the first run: $FIRST"

echo "-- second run"
SECOND=$(run_setup) || fail "the second run exited non-zero: $SECOND"
echo "$SECOND" | grep -q '✖' && fail "a step failed in the second run: $SECOND"
echo "$SECOND" | grep -q '^Next: npm run dev' || fail "no \"Next: npm run dev\" line after the second run"

echo "-- negative: the second run must not redo any step"
for step in "install dependencies" "start database" "run migrations"; do
  echo "$SECOND" | grep -q "^↷ $step — skipped" || fail "step \"$step\" was not skipped on the second run: $SECOND"
done
echo "PASS: SET-001"
