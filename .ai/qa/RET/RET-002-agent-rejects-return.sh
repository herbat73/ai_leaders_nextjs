#!/bin/sh
# RET-002: an agent signs in, finds a submitted return in the inbox and rejects it with a reason.
# Priority: High. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
#
# Setup: the customer side is created through the API (guest lookup, then POST /api/returns) on seeded order PL-10001.
# The rejection under test releases the held unit (D14), so a passing run leaves nothing behind. When the run fails
# before the rejection, cleanup rejects the return through the API so the scenario can run again.
# Prerequisites: same as RET-001 (test-env-up.sh works, .ai/qa/test-env.env holds TEST_AGENT_EMAIL/PASSWORD).
# Note: the agent-browser CLI takes the password as an argument; it is a local QA account on a disposable database.
set -eu

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
QA_DIR="$ROOT/.ai/qa"
ART_DIR="$QA_DIR/artifacts_RET-002"
ORDER_NUMBER=PL-10001
ORDER_EMAIL=anna.kowalska@example.pl
SHORT_NOTE="Za krótko"
NOTE="Zwrot odrzucony: automatyczny test RET-002, brak podstaw do zwrotu."

[ -f "$QA_DIR/test-env.env" ] || { echo "FAIL: $QA_DIR/test-env.env missing (see RET-001 header)" >&2; exit 2; }
set -a; . "$QA_DIR/test-env.env"; set +a

ENV_OUT=$(sh "$ROOT/.ai/scripts/test-env-up.sh" 2>&1) || { echo "$ENV_OUT" | tail -20 >&2; echo "FAIL: test environment did not start" >&2; exit 2; }
BASE_URL=$(echo "$ENV_OUT" | sed -n 's/^TEST_ENV_BASE_URL=//p' | tail -1)
AB=$(sed -n 's/.*"command": *"\([^"]*agent-browser[^"]*\)".*/\1/p' "$QA_DIR/test-env.json" | head -1)
[ -n "$BASE_URL" ] && [ -x "$AB" ] || { echo "FAIL: no base URL or agent-browser in the descriptor" >&2; exit 2; }

SESSION="qa-ret-002-$$"
RMA=""
REJECTED=0
GUEST_COOKIES=$(mktemp)
AGENT_COOKIES=$(mktemp)
mkdir -p "$ART_DIR"

ab() { "$AB" --session "$SESSION" "$@"; }
api() { curl -s -H 'x-requested-with: fetch' -H 'content-type: application/json' "$@"; }
fail() { echo "FAIL: $1" >&2; ab screenshot --full "$ART_DIR/failure.png" >/dev/null 2>&1 || true; exit 1; }
step() { echo "-- $1"; }
wait_text() { ab wait --text "$1" >/dev/null 2>&1 || fail "expected text \"$1\" on $(ab get url 2>&1 | head -1)"; }
click_role() { ab find role "$1" click --name "$2" >/dev/null 2>&1 || fail "no $1 named \"$2\""; }
snap() { ab snapshot -i 2>&1; }
shot() { ab screenshot --full "$ART_DIR/$1.png" >/dev/null 2>&1 || true; }

agent_login_api() {
  printf '{"email":"%s","password":"%s"}' "$TEST_AGENT_EMAIL" "$TEST_AGENT_PASSWORD" |
    api -o /dev/null -c "$AGENT_COOKIES" -X POST "$BASE_URL/api/agents/login" --data-binary @-
}

# Runs once; INT/TERM call `exit`, which would fire the EXIT trap a second time.
cleanup() {
  status=$?
  trap - EXIT INT TERM
  ab close >/dev/null 2>&1 || true
  if [ -n "$RMA" ] && [ "$REJECTED" = 0 ]; then
    agent_login_api
    RETURN_ID=$(api -b "$AGENT_COOKIES" "$BASE_URL/api/returns" | RMA="$RMA" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data;const r=a.find((x)=>x.rma===process.env.RMA);if(r)console.log(r.id)')
    if [ -n "${RETURN_ID:-}" ]; then
      code=$(api -o /dev/null -w '%{http_code}' -b "$AGENT_COOKIES" -X PATCH "$BASE_URL/api/returns/$RETURN_ID" \
        --data-raw '{"status":"rejected","decisionNote":"RET-002 cleanup: automated test return, units released."}')
      [ "$code" = 200 ] && echo "cleanup: $RMA rejected" || { echo "cleanup FAILED ($code): reject $RMA by hand" >&2; status=1; }
    else
      echo "cleanup FAILED: $RMA not found in the agent list" >&2; status=1
    fi
  fi
  rm -f "$GUEST_COOKIES" "$AGENT_COOKIES"
  exit "$status"
}
trap cleanup EXIT INT TERM

step "setup: customer submits a return through the API"
api -o /dev/null -c "$GUEST_COOKIES" -X POST "$BASE_URL/api/returns/lookup" \
  --data-raw "{\"orderNumber\":\"$ORDER_NUMBER\",\"email\":\"$ORDER_EMAIL\"}"
IDEM=$(node -e 'console.log(crypto.randomUUID())')
CREATED=$(api -b "$GUEST_COOKIES" -X POST "$BASE_URL/api/returns" \
  --data-raw "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$IDEM\"}")
RMA=$(echo "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (a unit held by an open request? reject it first): $CREATED"
echo "created $RMA"

step "agent signs in"
ab open "$BASE_URL/admin/login" >/dev/null 2>&1 || fail "cannot open the login page"
wait_text "Logowanie do panelu"
ab find label "E-mail" fill "$TEST_AGENT_EMAIL" >/dev/null 2>&1 || fail "no e-mail field"
ab find label "Hasło" fill "$TEST_AGENT_PASSWORD" >/dev/null 2>&1 || fail "no password field"
click_role button "Zaloguj się"
ab wait --url "**/admin/returns" >/dev/null 2>&1 || fail "login did not reach the inbox"
wait_text "Zwroty i reklamacje"

step "the return is in the inbox as submitted"
INBOX=$(snap)
echo "$INBOX" | grep -q "link \"$RMA\"" || fail "$RMA not listed in the inbox"
REF=$(echo "$INBOX" | sed -n "s/.*link \"$RMA\" \[ref=\(e[0-9]*\)\].*/\1/p" | head -1)
HREF=$(ab get attr "@$REF" href 2>&1 | head -1)
case "$HREF" in /admin/returns/*) ;; *) fail "unexpected link target for $RMA: $HREF" ;; esac
shot 01-inbox

# The RMA link wraps onto two lines in the narrow column, so a click at its box centre lands on the cell; open its href.
step "open the decision card"
ab open "$BASE_URL$HREF" >/dev/null 2>&1 || fail "cannot open $HREF"
wait_text "Decyzja"
snap | grep -q "heading \"$RMA\"" || fail "decision card is not for $RMA"

step "negative: a short reason keeps the reject button disabled"
click_role button "Odrzuć"
ab find label "Uzasadnienie dla klienta" fill "$SHORT_NOTE" >/dev/null 2>&1 || fail "no reason field"
snap | grep -q 'button "Odrzuć zgłoszenie" \[disabled' || fail "reject button enabled with a too short reason"

step "a long enough reason enables it; reject"
ab find label "Uzasadnienie dla klienta" fill "$NOTE" >/dev/null 2>&1 || fail "no reason field"
snap | grep 'button "Odrzuć zgłoszenie"' | grep -vq disabled || fail "reject button still disabled with a valid reason"
shot 02-reject-form
click_role button "Odrzuć zgłoszenie"
wait_text "Odrzucone"
REJECTED=1
wait_text "$NOTE"
snap | grep -q 'button "Zatwierdź"' && fail "decision buttons still shown after rejecting"
shot 03-rejected

step "the inbox shows the return as rejected"
ab open "$BASE_URL/admin/returns" >/dev/null 2>&1 || fail "cannot open the inbox"
wait_text "$RMA"
# The status filter also contains the word "Odrzucone", so read this row's own status cell (4th cell after its link).
ROW_STATUS=$(snap | awk -v link="link \"$RMA\"" 'index($0, link) { found = 1; next } found && /cell "/ { if (++n == 4) { print; exit } }')
case "$ROW_STATUS" in *'"Odrzucone"'*) ;; *) fail "inbox row for $RMA is not rejected: $ROW_STATUS" ;; esac

echo "PASS: RET-002 ($RMA)"
