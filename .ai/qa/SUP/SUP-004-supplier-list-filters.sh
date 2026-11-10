#!/bin/sh
# SUP-004: the supplier list pages by ten, filters by status, name and e-mail (all must match), and clears the text fields.
# Scenario: .ai/qa/SUP/SUP-004-supplier-list-filters.md
# Priority: Medium. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: twelve suppliers with a unique name/e-mail prefix through the API, the last two deactivated. Counts are asserted
# on that prefix, so other suppliers in the database do not matter. Cleanup deactivates every supplier the script made.
QA_ID=SUP-004
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
SUPPLIER_IDS=""
cleanup_extra() {
  agent_login_api
  for id in $SUPPLIER_IDS; do
    code=$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/suppliers/$id" --data-raw '{"active":false}')
    [ "$code" = 200 ] || { echo "cleanup FAILED ($code): deactivate supplier $id by hand" >&2; return 1; }
  done
  echo "cleanup: suppliers deactivated"
}
qa_init

rows() { ab eval "document.querySelectorAll('table tbody tr').length" 2>&1 | tail -1; }
TS=$(date +%s)
PREFIX="QA SUP-004 $TS"

step "setup: twelve suppliers, the last two inactive"
agent_login_api
n=0
while [ "$n" -lt 12 ]; do
  n=$((n + 1))
  NN=$(printf '%02d' "$n")
  out=$(agent_api -X POST "$BASE_URL/api/suppliers" --data-raw "{\"name\":\"$PREFIX $NN\",\"email\":\"qa004-$TS-$NN@qa-dostawca.example.pl\",\"guidelines\":null}")
  id=$(printf '%s' "$out" | json_get data.supplier.id)
  [ -n "$id" ] || fail "setup: supplier $NN not created: $out"
  SUPPLIER_IDS="$SUPPLIER_IDS $id"
  if [ "$n" -gt 10 ]; then
    [ "$(agent_api -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/suppliers/$id" --data-raw '{"active":false}')" = 200 ] || fail "setup: could not deactivate supplier $NN"
  fi
done

step "name search through the form: ten rows and a pager"
agent_login_ui
ab open "$BASE_URL/admin/suppliers" >/dev/null 2>&1 || fail "cannot open the suppliers page"
wait_text "Dostawcy, do których wysyłamy reklamacje"
fill_label "Nazwa" "$PREFIX"
click_role button "Szukaj"
wait_url "**name=*"
wait_text "Strona 1 z 2"
[ "$(rows)" = 10 ] || fail "expected 10 rows on page 1, got $(rows)"
shot 01-page-1

step "Następna moves to page 2 and keeps the filter"
click_role link "Następna"
wait_text "Strona 2 z 2"
case "$(cur_url)" in *page=2*name=*|*name=*page=2*) ;; *) fail "page 2 or the name filter missing from the URL: $(cur_url)" ;; esac
[ "$(rows)" = 2 ] || fail "expected 2 rows on page 2, got $(rows)"
shot 02-page-2

step "status filter: inactive lists two, active lists ten without a pager"
ab open "$BASE_URL/admin/suppliers?status=inactive&name=$(printf '%s' "$PREFIX" | sed 's/ /%20/g')" >/dev/null 2>&1 || fail "cannot open the inactive list"
wait_text "Nieaktywny"
[ "$(rows)" = 2 ] || fail "expected 2 inactive rows, got $(rows)"
ab open "$BASE_URL/admin/suppliers?status=active&name=$(printf '%s' "$PREFIX" | sed 's/ /%20/g')" >/dev/null 2>&1 || fail "cannot open the active list"
wait_text "Aktywny"
[ "$(rows)" = 10 ] || fail "expected 10 active rows, got $(rows)"
expect_no_text "Strona 1 z" "pager shown for a single page"

step "e-mail search through the form: one row"
ab open "$BASE_URL/admin/suppliers" >/dev/null 2>&1 || fail "cannot open the suppliers page"
wait_text "Dostawcy, do których wysyłamy reklamacje"
fill_label "E-mail" "QA004-$TS-07"
click_role button "Szukaj"
wait_url "**email=*"
wait_text "$PREFIX 07"
[ "$(rows)" = 1 ] || fail "expected 1 row for the e-mail search, got $(rows)"
shot 03-email

step "negative: name and e-mail that do not belong to one supplier list nothing"
ab open "$BASE_URL/admin/suppliers?name=$(printf '%s' "$PREFIX 01" | sed 's/ /%20/g')&email=qa004-$TS-02" >/dev/null 2>&1 || fail "cannot open the combined filter"
wait_text "Brak dostawców dla wybranych filtrów"
shot 04-no-match

step "Wyczyść clears the text fields"
click_role button "Wyczyść"
# The click navigates on the client, so wait for the URL to lose the filters instead of reading it at once.
i=0
while [ "$i" -lt 20 ]; do
  case "$(cur_url)" in *name=*|*email=*) i=$((i + 1)); sleep 0.5 ;; *) break ;; esac
done
case "$(cur_url)" in *name=*|*email=*) fail "filters still in the URL: $(cur_url)" ;; esac
wait_text "Dostawcy, do których wysyłamy reklamacje"
[ "$(ab eval "document.getElementById('supplier-filter-name').value + document.getElementById('supplier-filter-email').value" 2>&1 | tail -1 | tr -d '"')" = "" ] || fail "text fields not emptied"

step "negative: invalid status and page in the URL are ignored"
ab open "$BASE_URL/admin/suppliers?status=nie-ma&page=abc" >/dev/null 2>&1 || fail "cannot open the list with bad values"
wait_text "Dostawcy, do których wysyłamy reklamacje"
expect_no_text "Brak dostawców dla wybranych filtrów" "bad status narrowed the list"

step "deactivating the only row under the Aktywni filter makes it disappear"
ab open "$BASE_URL/admin/suppliers?status=active&email=qa004-$TS-01" >/dev/null 2>&1 || fail "cannot open the single-row list"
wait_text "$PREFIX 01"
[ "$(rows)" = 1 ] || fail "expected 1 row before the toggle, got $(rows)"
click_role button "Wyłącz"
wait_text "Brak dostawców dla wybranych filtrów"
shot 05-row-gone
echo "PASS: $QA_ID ($PREFIX)"
