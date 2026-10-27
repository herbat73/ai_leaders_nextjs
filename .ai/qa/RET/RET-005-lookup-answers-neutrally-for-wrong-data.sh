#!/bin/sh
# RET-005: a wrong order number and a wrong e-mail give the same neutral message, and no session is created.
# Scenario: .ai/qa/RET/RET-005-lookup-answers-neutrally-for-wrong-data.md
# Priority: High. Type: UI + API. Role: anonymous visitor. Creates nothing, so there is nothing to clean up.
# The lookup limiter counts failures per IP: this script makes 3 failed lookups.
QA_ID=RET-005
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
MSG="Nie znaleźliśmy zamówienia pasującego do podanych danych."
qa_init

step "negative: a wrong e-mail for an existing order"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"
fill_label "Numer zamówienia" "PL-10001"
fill_label "Adres e-mail" "ktos.inny@example.pl"
click_role button "Sprawdź zamówienie"
wait_text "$MSG"

step "negative: an unknown order number gives the same message"
fill_label "Numer zamówienia" "PL-99999"
fill_label "Adres e-mail" "anna.kowalska@example.pl"
click_role button "Sprawdź zamówienie"
wait_text "$MSG"
case "$(cur_url)" in "$BASE_URL"/|"$BASE_URL") ;; *) fail "left the lookup page after a failed lookup: $(cur_url)" ;; esac
shot 01-neutral-error

step "the API answers both failures with the same code and no session cookie"
A=$(api -D - -o /dev/null -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10001","email":"ktos.inny@example.pl"}')
printf '%s' "$A" | grep -qi '^set-cookie' && fail "a session cookie was issued for a failed lookup"
CODE_A=$(api -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10001","email":"ktos.inny@example.pl"}')
CODE_B=$(api -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-99999","email":"anna.kowalska@example.pl"}')
[ "$CODE_A" = "$CODE_B" ] || fail "different status codes for wrong e-mail ($CODE_A) and wrong number ($CODE_B)"
echo "PASS: $QA_ID"
