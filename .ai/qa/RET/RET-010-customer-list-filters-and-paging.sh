#!/bin/sh
# RET-010: the customer list pages by ten, filters by status, RMA fragment and submission day, and clears back to the full list.
# Scenario: .ai/qa/RET/RET-010-customer-list-filters-and-paging.md
# Priority: Medium. Type: UI with API setup. Role: guest customer (order PL-10001); an agent (QA account) is used only for cleanup.
# Setup: a return is created through the API on seeded order PL-10001 (line L2) and stays `submitted`, so it is the newest
# row; earlier runs leave the order with more than ten requests, which gives the list more than one page. Cleanup rejects it.
QA_ID=RET-010
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

rows() { ab eval "document.querySelectorAll('section[aria-label=\"Zgłoszenia zwrotu i reklamacji\"] ul li').length" 2>&1 | tail -1; }

step "setup: customer submits a return through the API"
guest_lookup PL-10001 anna.kowalska@example.pl
CREATED=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (unit held by an open request?): $CREATED"
echo "created $RMA"
TODAY=$(TZ=Europe/Warsaw date +%F)

step "the list shows ten rows, the newest first, and a pager"
# The server-rendered lookup page shows its text before hydration; a fill made too early is wiped, so retry the whole attempt.
for attempt in 1 2 3; do
  ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
  wait_text "Zwrot zamówienia"
  sleep 2
  ab find label "Numer zamówienia" fill PL-10001 >/dev/null 2>&1 && ab find label "Adres e-mail" fill anna.kowalska@example.pl >/dev/null 2>&1 \
    && ab find role button click --name "Sprawdź zamówienie" >/dev/null 2>&1 && ab wait --url "**/returns" >/dev/null 2>&1 && break
  [ "$attempt" = 3 ] && fail "customer lookup did not reach /returns"
done
wait_text "Strona 1 z"
[ "$(rows)" = 10 ] || fail "expected 10 rows on page 1, got $(rows)"
expect_text "$RMA" "$RMA missing from page 1"
shot 01-page-1

step "Następna keeps the filters and moves to page 2"
click_role link "Następna"
wait_text "Strona 2 z"
case "$(cur_url)" in *page=2*) ;; *) fail "page 2 not in the URL: $(cur_url)" ;; esac
expect_no_text "$RMA" "$RMA still listed on page 2"
shot 02-page-2

step "search by an RMA fragment through the form"
ab open "$BASE_URL/returns" >/dev/null 2>&1 || fail "cannot open the list"
wait_text "Strona 1 z"
fill_label "Numer RMA" "$(printf '%s' "$RMA" | tr 'A-Z' 'a-z')"
click_role button "Szukaj"
wait_url "**q=*"
wait_text "$RMA"
[ "$(rows)" = 1 ] || fail "expected 1 row for the RMA search, got $(rows)"
expect_no_text "Strona 1 z" "pager shown for a single page"
shot 03-search

step "status filter: submitted lists it, resolved with the same RMA lists nothing"
ab open "$BASE_URL/returns?status=submitted&q=$RMA" >/dev/null 2>&1 || fail "cannot open the filtered list"
wait_text "$RMA"
ab open "$BASE_URL/returns?status=resolved&q=$RMA" >/dev/null 2>&1 || fail "cannot open the filtered list"
wait_text "Brak zgłoszeń dla wybranych filtrów"
expect_no_text "Nie masz jeszcze zgłoszeń" "the empty-order message shown for a filter with no match"

step "date range: today lists it, a past range and a reversed range list nothing"
ab open "$BASE_URL/returns?from=$TODAY&to=$TODAY&q=$RMA" >/dev/null 2>&1 || fail "cannot open the filtered list"
wait_text "$RMA"
ab open "$BASE_URL/returns?from=2000-01-01&to=2000-01-02&q=$RMA" >/dev/null 2>&1 || fail "cannot open the filtered list"
wait_text "Brak zgłoszeń dla wybranych filtrów"
ab open "$BASE_URL/returns?from=2030-01-01&to=2020-01-01&q=$RMA" >/dev/null 2>&1 || fail "cannot open the filtered list"
wait_text "Brak zgłoszeń dla wybranych filtrów"
shot 04-no-match

step "Wyczyść returns to the full list"
click_role link "Wyczyść"
wait_text "Strona 1 z"
case "$(cur_url)" in */returns) ;; *) fail "clear did not reach /returns: $(cur_url)" ;; esac
[ "$(rows)" = 10 ] || fail "expected 10 rows after clearing, got $(rows)"

step "negative: invalid status, date and page in the URL are ignored"
ab open "$BASE_URL/returns?status=nie-ma&from=xx&page=abc" >/dev/null 2>&1 || fail "cannot open the list with bad values"
wait_text "Strona 1 z"
[ "$(rows)" = 10 ] || fail "bad query values changed the list ($(rows) rows)"
echo "PASS: $QA_ID ($RMA)"
