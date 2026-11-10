#!/bin/sh
# SUP-005: the supplier claims list pages by ten, filters by status, claim number or RMA, supplier name and creation day
# (all must match), and clears the text and date fields.
# Scenario: .ai/qa/SUP/SUP-005-supplier-claims-list-filters.md
# Priority: Medium. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: two QA suppliers; one real claim (complaint on PL-10005 L2, marked sent) and eleven more claims written straight
# into the disposable test database on earlier, rejected history returns (PL-10001 L2), one per past day, nine `sent` and
# two `draft`, alternating between the two suppliers. Counts are asserted on the supplier name prefix.
QA_ID=SUP-005
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
SUPPLIER_B_ID=""
cleanup_extra() {
  cleanup_supplier || return 1
  [ -n "$SUPPLIER_B_ID" ] || return 0
  code=$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/suppliers/$SUPPLIER_B_ID" --data-raw '{"active":false}')
  [ "$code" = 200 ] || { echo "cleanup FAILED ($code): deactivate supplier $SUPPLIER_B_ID by hand" >&2; return 1; }
}
qa_init

rows() { ab eval "document.querySelectorAll('table tbody tr').length" 2>&1 | tail -1; }
enc() { printf '%s' "$1" | sed 's/ /%20/g'; }
list_url() { echo "$BASE_URL/admin/supplier-claims?$1"; }
open_list() { ab open "$(list_url "$1")" >/dev/null 2>&1 || fail "cannot open the claims list ($1)"; wait_text "Reklamacje do dostawców"; }

step "setup: two suppliers, one real sent claim"
agent_login_api
supplier_create
SUPPLIER_A_NAME="$SUPPLIER_NAME"
SUPPLIER_B_NAME="$SUPPLIER_A_NAME B"
out=$(agent_api -X POST "$BASE_URL/api/suppliers" --data-raw "{\"name\":\"$SUPPLIER_B_NAME\",\"email\":\"b@qa-dostawca.example.pl\",\"guidelines\":null}")
SUPPLIER_B_ID=$(printf '%s' "$out" | json_get data.supplier.id)
[ -n "$SUPPLIER_B_ID" ] || fail "setup: supplier B not created: $out"
complaint_create PL-10005 maria.lewandowska@example.pl L2
complaint_to_received true
claim_create_sent
REAL_RMA="$RMA"

step "setup: eleven claims on rejected history returns, one per past day"
guest_lookup PL-10001 anna.kowalska@example.pl
AGENT_ID=$(db_sql "SELECT min(id) FROM agents")
TS=$(date +%s)
n=0
while [ "$n" -lt 11 ]; do
  n=$((n + 1))
  OLD=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
  OLD_RMA=$(printf '%s' "$OLD" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
  [ -n "$OLD_RMA" ] || fail "setup: history return $n not created: $OLD"
  OLD_ID=$(return_id_for "$OLD_RMA")
  [ "$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/returns/$OLD_ID" --data-raw '{"status":"rejected","decisionNote":"SUP-005 setup: history return, unit released."}')" = 200 ] || fail "setup: could not reject $OLD_RMA"
  NN=$(printf '%02d' "$n")
  if [ $((n % 2)) = 0 ]; then SID="$SUPPLIER_B_ID"; else SID="$SUPPLIER_ID"; fi
  if [ "$n" -gt 9 ]; then ST=draft; else ST=sent; fi
  db_sql "INSERT INTO supplier_claims (ref, return_request_id, supplier_id, status, subject, body, created_by_agent_id, created_at, updated_at) VALUES ('SC-QA-$TS-$NN', $OLD_ID, $SID, '$ST', 'SUP-005', 'SUP-005', $AGENT_ID, now() - interval '$n days', now())" >/dev/null || fail "setup: claim $NN not inserted"
done
DAY5=$(db_sql "SELECT to_char((now() - interval '5 days') AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD')")
[ -n "$DAY5" ] || fail "setup: could not compute the Warsaw day of claim 05"

step "supplier search through the form: ten rows and a pager"
agent_login_ui
open_list ""
fill_label "Dostawca" "$SUPPLIER_A_NAME"
click_role button "Szukaj"
wait_url "**supplier=*"
wait_text "Strona 1 z 2"
[ "$(rows)" = 10 ] || fail "expected 10 rows on page 1, got $(rows)"
shot 01-page-1

step "Następna moves to page 2 and keeps the filter"
click_role link "Następna"
wait_text "Strona 2 z 2"
case "$(cur_url)" in *page=2*supplier=*|*supplier=*page=2*) ;; *) fail "page 2 or the supplier filter missing from the URL: $(cur_url)" ;; esac
[ "$(rows)" = 2 ] || fail "expected 2 rows on page 2, got $(rows)"
shot 02-page-2

step "supplier B only: five claims, no pager"
open_list "supplier=$(enc "$SUPPLIER_B_NAME")"
wait_text "$SUPPLIER_B_NAME"
[ "$(rows)" = 5 ] || fail "expected 5 rows for supplier B, got $(rows)"
expect_no_text "Strona 1 z" "pager shown for a single page"

step "status filter: draft lists two, sent lists ten (nine seeded and the real one)"
open_list "status=draft&supplier=$(enc "$SUPPLIER_A_NAME")"
wait_text "Szkic, nie wysłano"
[ "$(rows)" = 2 ] || fail "expected 2 draft rows, got $(rows)"
open_list "status=sent&supplier=$(enc "$SUPPLIER_A_NAME")"
wait_text "Wysłano, czekamy na dostawcę"
[ "$(rows)" = 10 ] || fail "expected 10 sent rows, got $(rows)"
shot 03-status

step "number search through the form: a claim number fragment, then an RMA (either)"
open_list ""
fill_label "Numer" "sc-qa-$TS-05"
click_role button "Szukaj"
wait_url "**q=*"
wait_text "SC-QA-$TS-05"
[ "$(rows)" = 1 ] || fail "expected 1 row for the claim number, got $(rows)"
open_list ""
fill_label "Numer" "$(printf '%s' "$REAL_RMA" | tr 'A-Z' 'a-z')"
click_role button "Szukaj"
wait_url "**q=*"
wait_text "$REAL_RMA"
[ "$(rows)" = 1 ] || fail "expected 1 row for the RMA, got $(rows)"
shot 04-number

step "creation day: one day returns exactly that claim, from after to returns nothing"
open_list "from=$DAY5&to=$DAY5&supplier=$(enc "$SUPPLIER_A_NAME")"
wait_text "SC-QA-$TS-05"
[ "$(rows)" = 1 ] || fail "expected 1 row for $DAY5, got $(rows)"
open_list "from=$(db_sql "SELECT to_char((now() - interval '2 days') AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD')")&to=$DAY5"
wait_text "Brak reklamacji dla wybranych filtrów"
shot 05-no-match

step "Wyczyść clears the text and date fields"
open_list "q=sc-qa&supplier=qa&from=$DAY5"
click_role button "Wyczyść"
# The click navigates on the client, so wait for the URL to lose the filters instead of reading it at once.
i=0
while [ "$i" -lt 20 ]; do
  case "$(cur_url)" in *q=*|*supplier=*|*from=*) i=$((i + 1)); sleep 0.5 ;; *) break ;; esac
done
case "$(cur_url)" in *q=*|*supplier=*|*from=*) fail "filters still in the URL: $(cur_url)" ;; esac
wait_text "Reklamacje do dostawców"
[ "$(ab eval "['claim-filter-q','claim-filter-supplier','claim-filter-from','claim-filter-to'].map((id)=>document.getElementById(id).value).join('')" 2>&1 | tail -1 | tr -d '"')" = "" ] || fail "fields not emptied"

step "negative: invalid status, malformed date and bad page are handled"
open_list "status=nie-ma&from=20.10.2026&page=abc"
wait_text "Nieznany status w filtrze"
expect_no_text "Brak reklamacji dla wybranych filtrów" "bad values narrowed the list"
echo "PASS: $QA_ID ($SUPPLIER_A_NAME)"
