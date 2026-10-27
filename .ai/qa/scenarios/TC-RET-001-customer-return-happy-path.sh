#!/bin/sh
# TC-RET-001: customer submits a return end to end (order lookup -> wizard -> RMA status page).
# Priority: High. Type: UI. Role: guest customer; an agent (QA account) is used only for cleanup.
#
# Prerequisites: `sh .ai/scripts/test-env-up.sh` works on this machine (run om-prepare-test-env once), and
# .ai/qa/test-env.env (gitignored) holds TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD of an agent with MANAGE_RULES.
# Order data: the app's fake order source (seeded PL-10001 / anna.kowalska@example.pl, line "Skarpety").
# Cleanup: the created return is rejected through PATCH /api/returns/[id] so its unit is released (D14) and the
# scenario can run again. Fail fast on the command line, never with per-test retries.
set -eu

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
QA_DIR="$ROOT/.ai/qa"
ART_DIR="$QA_DIR/artifacts_TC-RET-001"
ORDER_NUMBER=PL-10001
ORDER_EMAIL=anna.kowalska@example.pl
ITEM_NAME="Skarpety"

[ -f "$QA_DIR/test-env.env" ] || { echo "FAIL: $QA_DIR/test-env.env missing (needs TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD, see header)" >&2; exit 2; }
set -a; . "$QA_DIR/test-env.env"; set +a

ENV_OUT=$(sh "$ROOT/.ai/scripts/test-env-up.sh" 2>&1) || { echo "$ENV_OUT" | tail -20 >&2; echo "FAIL: test environment did not start" >&2; exit 2; }
BASE_URL=$(echo "$ENV_OUT" | sed -n 's/^TEST_ENV_BASE_URL=//p' | tail -1)
AB=$(sed -n 's/.*"command": *"\([^"]*agent-browser[^"]*\)".*/\1/p' "$QA_DIR/test-env.json" | head -1)
[ -n "$BASE_URL" ] && [ -x "$AB" ] || { echo "FAIL: no base URL or agent-browser in the descriptor" >&2; exit 2; }

SESSION="qa-tc-ret-001-$$"
RMA=""
COOKIES="$QA_DIR/.tc-ret-001-cookies.$$"
mkdir -p "$ART_DIR"

ab() { "$AB" --session "$SESSION" "$@"; }
fail() { echo "FAIL: $1" >&2; ab screenshot --full "$ART_DIR/failure.png" >/dev/null 2>&1 || true; exit 1; }
step() { echo "-- $1"; }
wait_url() { ab wait --url "$1" >/dev/null 2>&1 || fail "expected URL $1, got $(ab get url 2>&1 | head -1)"; }
wait_text() { ab wait --text "$1" >/dev/null 2>&1 || fail "expected text \"$1\" on $(ab get url 2>&1 | head -1)"; }
click_role() { ab find role "$1" click --name "$2" >/dev/null 2>&1 || fail "no $1 named \"$2\""; }
shot() { ab screenshot --full "$ART_DIR/$1.png" >/dev/null 2>&1 || true; }

# Releases the unit held by the created return: agent login, then reject the RMA (30+ character note not required here,
# the note below satisfies the rule anyway).
cleanup() {
  status=$?
  ab close >/dev/null 2>&1 || true
  if [ -n "$RMA" ]; then
    curl -s -o /dev/null -c "$COOKIES" -X POST "$BASE_URL/api/agents/login" -H 'x-requested-with: fetch' \
      -H 'content-type: application/json' --data-raw "{\"email\":\"$TEST_AGENT_EMAIL\",\"password\":\"$TEST_AGENT_PASSWORD\"}"
    RETURN_ID=$(curl -s -b "$COOKIES" "$BASE_URL/api/returns" | RMA="$RMA" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data;const r=a.find((x)=>x.rma===process.env.RMA);if(r)console.log(r.id)')
    if [ -n "${RETURN_ID:-}" ]; then
      code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES" -X PATCH "$BASE_URL/api/returns/$RETURN_ID" -H 'x-requested-with: fetch' \
        -H 'content-type: application/json' --data-raw '{"status":"rejected","decisionNote":"TC-RET-001 cleanup: automated test return, units released."}')
      [ "$code" = 200 ] && echo "cleanup: $RMA rejected" || { echo "cleanup FAILED ($code): reject $RMA by hand" >&2; status=1; }
    else
      echo "cleanup FAILED: $RMA not found in the agent list" >&2; status=1
    fi
  fi
  rm -f "$COOKIES"
  exit "$status"
}
trap cleanup EXIT INT TERM

step "open the lookup page"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"

step "look up the order"
ab find label "Numer zamówienia" fill "$ORDER_NUMBER" >/dev/null 2>&1 || fail "no order number field"
ab find label "Adres e-mail" fill "$ORDER_EMAIL" >/dev/null 2>&1 || fail "no e-mail field"
click_role button "Sprawdź zamówienie"
wait_url "**/returns"
wait_text "Twoje zgłoszenia"
shot 01-returns-list

step "start a return and pick one item"
click_role link "Rozpocznij zwrot"
wait_url "**/returns/new"
wait_text "Które produkty chcesz zwrócić?"
ab find role checkbox click --name "$ITEM_NAME" >/dev/null 2>&1 || fail "item \"$ITEM_NAME\" not selectable (unit held by an open return? reject it first)"
click_role button "Dalej"
wait_text "Dlaczego zwracasz"

step "reason, shipping, resolution"
ab find role radio click --name "Nieodpowiedni rozmiar" >/dev/null 2>&1 || fail "no reason option"
click_role button "Dalej"
wait_text "Jak odeślesz paczkę?"
ab find role radio click --name "Zwrot w sklepie" >/dev/null 2>&1 || fail "no shipping option"
click_role button "Dalej"
wait_text "Co chcesz otrzymać?"
ab find role radio click --name "Zwrot pieniędzy" >/dev/null 2>&1 || fail "no resolution option"
click_role button "Dalej"
wait_text "Sprawdź i wyślij zgłoszenie"
shot 02-summary

step "negative: submit without confirming stays on the summary"
click_role button "Wyślij zgłoszenie"
sleep 1
case "$(ab get url 2>&1 | head -1)" in */returns/new) ;; *) fail "submitted without the confirmation checkbox" ;; esac
wait_text "Sprawdź i wyślij zgłoszenie"

step "confirm and submit"
ab find role checkbox click --name "Potwierdzam" >/dev/null 2>&1 || fail "no confirmation checkbox"
click_role button "Wyślij zgłoszenie"
wait_url "**/returns/RMA-*"
RMA=$(ab get url 2>&1 | head -1 | sed -n 's#.*/returns/\(RMA-[0-9]*-[0-9]*\).*#\1#p')
[ -n "$RMA" ] || fail "no RMA number in the URL"
echo "created $RMA"

step "status page shows the new return as submitted"
wait_text "Aktualny status: Zgłoszone"
wait_text "Skarpety"
shot 03-status

echo "PASS: TC-RET-001 ($RMA)"
