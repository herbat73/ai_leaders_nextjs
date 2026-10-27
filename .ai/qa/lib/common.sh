# Shared helpers for the POSIX QA scenario scripts in .ai/qa/<AREA>/. Source it, do not execute it.
#
#   QA_ID=CMP-001
#   . "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
#   qa_init            # env, base URL, agent-browser, session, artifacts dir, cleanup trap
#
# A script sets RMA (and RMAS) to what it created so cleanup rejects them, and may define `cleanup_extra`.
# Needs .ai/qa/test-env.env (gitignored) with TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD of an agent with MANAGE_RULES.
set -eu

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
QA_DIR="$ROOT/.ai/qa"
RMA=""
RMAS=""
COOKIES=$(mktemp)

qa_init() {
  ART_DIR="$QA_DIR/artifacts_$QA_ID"
  [ -f "$QA_DIR/test-env.env" ] || { echo "FAIL: $QA_DIR/test-env.env missing (needs TEST_AGENT_EMAIL / TEST_AGENT_PASSWORD)" >&2; exit 2; }
  set -a; . "$QA_DIR/test-env.env"; set +a
  ENV_OUT=$(sh "$ROOT/.ai/scripts/test-env-up.sh" 2>&1) || { echo "$ENV_OUT" | tail -20 >&2; echo "FAIL: test environment did not start" >&2; exit 2; }
  BASE_URL=$(echo "$ENV_OUT" | sed -n 's/^TEST_ENV_BASE_URL=//p' | tail -1)
  AB=$(sed -n 's/.*"command": *"\([^"]*agent-browser[^"]*\)".*/\1/p' "$QA_DIR/test-env.json" | head -1)
  [ -n "$BASE_URL" ] && [ -x "$AB" ] || { echo "FAIL: no base URL or agent-browser in the descriptor" >&2; exit 2; }
  SESSION="qa-$(echo "$QA_ID" | tr 'A-Z' 'a-z')-$$"
  mkdir -p "$ART_DIR"
  trap qa_cleanup EXIT INT TERM
}

ab() { "$AB" --session "$SESSION" "$@"; }
api() { curl -s -H 'x-requested-with: fetch' -H 'content-type: application/json' "$@"; }
step() { echo "-- $1"; }
shot() { ab screenshot --full "$ART_DIR/$1.png" >/dev/null 2>&1 || true; }
snap() { ab snapshot -i 2>&1; }
cur_url() { ab get url 2>&1 | head -1; }
fail() { echo "FAIL: $1" >&2; ab screenshot --full "$ART_DIR/failure.png" >/dev/null 2>&1 || true; exit 1; }
wait_url() { ab wait --url "$1" >/dev/null 2>&1 || fail "expected URL $1, got $(cur_url)"; }
wait_text() { ab wait --text "$1" >/dev/null 2>&1 || fail "expected text \"$1\" on $(cur_url)"; }
click_role() { ab find role "$1" click --name "$2" >/dev/null 2>&1 || fail "no $1 named \"$2\""; }
fill_label() { ab find label "$1" fill "$2" >/dev/null 2>&1 || fail "no field labelled \"$1\""; }
# A native date input ignores `fill`; set it through the value setter React listens to, then fire `input`.
fill_date() {
  got=$(ab eval "(()=>{const i=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'$1');i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()" 2>&1 | tail -1)
  [ "$got" = "\"$1\"" ] || fail "date input not set to $1 (got $got)"
}
expect_snap() { snap | grep -q "$1" || fail "$2"; }
expect_no_snap() { snap | grep -q "$1" && fail "$2"; return 0; }
# Visible page text, for assertions that an interactive snapshot cannot make (headings, paragraphs).
expect_no_text() { ab eval "document.body.innerText.includes('$1')" 2>&1 | tail -1 | grep -q false || fail "$2"; }
expect_text() { ab eval "document.body.innerText.includes('$1')" 2>&1 | tail -1 | grep -q true || fail "$2"; }
# After picking an option the select popup animates out and hides the page from the accessibility tree; wait for it.
wait_listbox_closed() {
  i=0
  until ab eval "!document.querySelector('[role=listbox]')" 2>&1 | tail -1 | grep -q true; do
    i=$((i + 1)); [ "$i" -gt 20 ] && fail "select popup did not close"
    ab wait 250 >/dev/null 2>&1
  done
}
json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=process.argv[1].split(".").reduce((o,k)=>o==null?o:o[k],JSON.parse(s));if(v!=null)console.log(typeof v==="object"?JSON.stringify(v):v)}catch{}})' "$1"; }

# Customer side through the API (guest lookup, then POST /api/returns). Prints the response body.
guest_lookup() { api -o /dev/null -c "$COOKIES.guest" -X POST "$BASE_URL/api/returns/lookup" --data-raw "{\"orderNumber\":\"$1\",\"email\":\"$2\"}"; }
guest_submit() { api -b "$COOKIES.guest" -X POST "$BASE_URL/api/returns" --data-raw "$1"; }
new_key() { node -e 'console.log(crypto.randomUUID())'; }

# Files a complaint for one line through the API (guest session); sets RMA, or fails with the response body.
# usage: complaint_create <order> <email> <lineRef> [resolution]
complaint_create() {
  guest_lookup "$1" "$2"
  CREATED=$(guest_submit "{\"kind\":\"complaint\",\"items\":[{\"lineRef\":\"$3\",\"quantity\":1}],\"defectDescription\":\"Automatyczny test $QA_ID: produkt ma wade widoczna od pierwszego uzycia.\",\"defectDiscoveredOn\":\"$(date +%Y-%m-%d)\",\"resolution\":\"${4:-repair}\",\"returnMethod\":\"courier\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
  RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
  [ -n "$RMA" ] || fail "setup: complaint not created (unit held by an open request?): $CREATED"
  echo "created $RMA"
}

# Logs in once per script run: the login route is throttled (10 attempts a minute per IP), and several scripts in a row hit it.
AGENT_API_LOGGED=0
agent_login_api() {
  [ "$AGENT_API_LOGGED" = 1 ] && return 0
  code=$(printf '{"email":"%s","password":"%s"}' "$TEST_AGENT_EMAIL" "$TEST_AGENT_PASSWORD" |
    api -o /dev/null -w '%{http_code}' -c "$COOKIES" -X POST "$BASE_URL/api/agents/login" --data-binary @-)
  [ "$code" = 200 ] || { echo "FAIL: agent API login answered $code (throttled? wait a minute)" >&2; exit 1; }
  AGENT_API_LOGGED=1
}
agent_api() { api -b "$COOKIES" "$@"; }
# Prints "<id> <status>" of the RMA from the agent list (the by-id route returns a list shape, so read the list).
return_row_for() { agent_api "$BASE_URL/api/returns" | RMA="$1" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data;const r=a.find((x)=>x.rma===process.env.RMA);if(r)console.log(r.id+" "+r.status)'; }
return_id_for() { return_row_for "$1" | cut -d' ' -f1; }

# Agent signs in through the browser.
agent_login_ui() {
  ab open "$BASE_URL/admin/login" >/dev/null 2>&1 || fail "cannot open the login page"
  wait_text "Logowanie do panelu"
  fill_label "E-mail" "$TEST_AGENT_EMAIL"
  fill_label "Hasło" "$TEST_AGENT_PASSWORD"
  click_role button "Zaloguj się"
  ab wait --url "**/admin/returns" >/dev/null 2>&1 || fail "login did not reach the inbox"
  wait_text "Zwroty i reklamacje"
}

# Agent moves a request through the API; prints the HTTP status. usage: agent_move <id> <status> [defectConfirmed]
agent_move() {
  extra=""; [ $# -ge 3 ] && extra=",\"defectConfirmed\":$3"
  agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/returns/$1" --data-raw "{\"status\":\"$2\"$extra}"
}
# Walks a freshly created complaint to `received` through the API. usage: complaint_to_received <true|false>
complaint_to_received() {
  agent_login_api
  CID=$(return_id_for "$RMA")
  [ -n "$CID" ] || fail "setup: $RMA not in the agent list"
  for to in approved in_transit; do [ "$(agent_move "$CID" "$to")" = 200 ] || fail "setup: move to $to failed"; done
  [ "$(agent_move "$CID" received "$1")" = 200 ] || fail "setup: move to received failed"
}
# QA-only escape hatch (see db_release_rma): run SQL on the disposable local test database.
db_sql() {
  if command -v psql >/dev/null 2>&1; then
    psql "${DATABASE_URL:-postgres://easyrms:easyrms@127.0.0.1:5433/easyrms}" -qtAc "$1"
  else
    (cd "$ROOT" && docker compose exec -T postgres psql -U easyrms -d easyrms -qtAc "$1" </dev/null)
  fi
}
# Creates a supplier through the API with a unique name; sets SUPPLIER_ID and SUPPLIER_NAME (cleanup deactivates it).
supplier_create() {
  SUPPLIER_NAME="QA $QA_ID $(date +%s)"
  out=$(agent_api -X POST "$BASE_URL/api/suppliers" --data-raw "{\"name\":\"$SUPPLIER_NAME\",\"email\":\"reklamacje@qa-dostawca.example.pl\",\"guidelines\":\"Wymagane wideo wady.\"}")
  SUPPLIER_ID=$(printf '%s' "$out" | json_get data.supplier.id)
  [ -n "$SUPPLIER_ID" ] || fail "setup: supplier not created: $out"
}
# Creates the supplier claim for $RMA through the API (it is saved as `draft` under the log transport), then marks it `sent`
# in the test database: the answer flow under test starts from `sent`, and a delivering SMTP transport is not part of the
# shared test env. Sets CLAIM_ID.
claim_create_sent() {
  out=$(agent_api -X POST "$BASE_URL/api/supplier-claims" --data-raw "{\"returnId\":$CID,\"supplierId\":$SUPPLIER_ID}")
  CLAIM_ID=$(printf '%s' "$out" | json_get data.claim.id); [ -n "$CLAIM_ID" ] || CLAIM_ID=$(printf '%s' "$out" | json_get data.id)
  [ -n "$CLAIM_ID" ] || fail "setup: supplier claim not created: $out"
  db_sql "UPDATE supplier_claims SET status='sent', sent_at=now() WHERE id=$CLAIM_ID AND status='draft'" >/dev/null
}
cleanup_supplier() {
  [ -n "${SUPPLIER_ID:-}" ] || return 0
  agent_login_api
  code=$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/suppliers/$SUPPLIER_ID" --data-raw '{"active":false}')
  [ "$code" = 200 ] && echo "cleanup: supplier $SUPPLIER_ID deactivated" || { echo "cleanup FAILED ($code): deactivate supplier $SUPPLIER_ID by hand" >&2; return 1; }
}

# Second browser session (another agent or a guest) for scenarios that need two people at once.
ab2() { "$AB" --session "$SESSION-2" "$@"; }
# Disables the agent with e-mail $1 through the API (QA agents created by a scenario are never deleted, only disabled).
disable_agent_by_email() {
  agent_login_api
  aid=$(agent_api "$BASE_URL/api/agents" | E="$1" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data.agents||d.data;const r=a.find((x)=>x.email===process.env.E);if(r)console.log(r.id)')
  [ -n "${aid:-}" ] || return 0
  code=$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/agents/$aid" --data-raw '{"status":"disabled"}')
  [ "$code" = 200 ] && echo "cleanup: agent $1 disabled" || { echo "cleanup FAILED ($code): disable agent $1 by hand" >&2; return 1; }
}

# Opens the decision card of $1 from the inbox (the RMA link wraps in a narrow column, so open its href).
open_card() {
  ab open "$BASE_URL/admin/returns" >/dev/null 2>&1 || fail "cannot open the inbox"
  wait_text "$1"
  REF=$(snap | sed -n "s/.*link \"$1\" \[ref=\(e[0-9]*\)\].*/\1/p" | head -1)
  [ -n "$REF" ] || fail "$1 not listed in the inbox"
  HREF=$(ab get attr "@$REF" href 2>&1 | head -1)
  case "$HREF" in /admin/returns/*) ;; *) fail "unexpected link target for $1: $HREF" ;; esac
  ab open "$BASE_URL$HREF" >/dev/null 2>&1 || fail "cannot open $HREF"
  wait_text "Decyzja"
}

# A complaint past `received` cannot be rejected or cancelled through the API (no such move), so its unit stays held for
# good. QA-only escape hatch on the disposable local test database: mark it rejected directly. Not for app code.
db_release_rma() {
  db_sql "UPDATE return_requests SET status='rejected' WHERE rma='$1' AND status IN ('received','in_service','resolved')" >/dev/null
}

# Releases every unit held by the RMAs this run created: agent login, then reject (needs a note of 30+ characters).
# A complaint past `received` is already out of reach of a plain reject; those scripts clean up in cleanup_extra.
qa_cleanup() {
  status=$?
  trap - EXIT INT TERM
  ab close >/dev/null 2>&1 || true
  ab2 close >/dev/null 2>&1 || true
  if command -v cleanup_extra >/dev/null 2>&1; then cleanup_extra || status=1; fi
  for r in $RMA $RMAS; do
    [ -n "$r" ] || continue
    agent_login_api
    row=$(return_row_for "$r")
    if [ -n "$row" ]; then
      id=${row%% *}; cur=${row#* }
      case "$cur" in
        rejected|cancelled) echo "cleanup: $r already $cur" ;;
        received|in_service|resolved)
          db_release_rma "$r" && echo "cleanup: $r released in the test database" || { echo "cleanup FAILED: release $r by hand" >&2; status=1; } ;;
        *)
          code=$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/returns/$id" \
            --data-raw "{\"status\":\"rejected\",\"decisionNote\":\"$QA_ID cleanup: automated test request, units released.\"}")
          [ "$code" = 200 ] && echo "cleanup: $r rejected" || { echo "cleanup FAILED ($code): reject $r by hand" >&2; status=1; } ;;
      esac
    else
      echo "cleanup FAILED: $r not found in the agent list" >&2; status=1
    fi
  done
  rm -f "$COOKIES" "$COOKIES.guest"
  exit "$status"
}
