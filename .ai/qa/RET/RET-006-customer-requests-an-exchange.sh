#!/bin/sh
# RET-006: a customer chooses "Wymiana": the exchange note is required, no amount is quoted, the status page shows the return.
# Scenario: .ai/qa/RET/RET-006-customer-requests-an-exchange.md
# Priority: Medium. Type: UI. Role: guest customer; an agent (QA account) is used only for cleanup.
# Order data: seeded PL-10001 / anna.kowalska@example.pl, line "Skarpety".
QA_ID=RET-006
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "look up the order and start a return with one item"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"
fill_label "Numer zamówienia" "PL-10001"
fill_label "Adres e-mail" "anna.kowalska@example.pl"
click_role button "Sprawdź zamówienie"
wait_url "**/returns"
click_role link "Rozpocznij zwrot"
wait_url "**/returns/new"
wait_text "Które produkty chcesz zwrócić?"
ab find role checkbox click --name "Skarpety" >/dev/null 2>&1 || fail "item not selectable (unit held by an open return?)"
click_role button "Dalej"
wait_text "Dlaczego zwracasz"
ab find role radio click --name "Nieodpowiedni rozmiar" >/dev/null 2>&1 || fail "no reason option"
click_role button "Dalej"
wait_text "Jak odeślesz paczkę?"
ab find role radio click --name "Zwrot w sklepie" >/dev/null 2>&1 || fail "no shipping option"
click_role button "Dalej"
wait_text "Co chcesz otrzymać?"

step "choose the exchange: no amount is quoted"
ab find role radio click --name "Wymiana" >/dev/null 2>&1 || fail "no exchange option"
wait_text "Na co chcesz wymienić?"
expect_no_text "Szacowana kwota zwrotu" "a refund quote is shown for an exchange"

step "negative: continuing without the exchange note is refused"
click_role button "Dalej"
wait_text "Opisz, na co chcesz wymienić produkt."

step "describe the exchange and continue to the summary"
fill_label "Na co chcesz wymienić?" "Skarpety wełniane w rozmiarze L"
click_role button "Dalej"
wait_text "Sprawdź i wyślij zgłoszenie"
wait_text "Skarpety wełniane w rozmiarze L"
shot 01-summary

step "confirm and submit"
ab find role checkbox click --name "Potwierdzam" >/dev/null 2>&1 || fail "no confirmation checkbox"
click_role button "Wyślij zgłoszenie"
wait_url "**/returns/RMA-*"
RMA=$(cur_url | sed -n 's#.*/returns/\(RMA-[0-9]*-[0-9]*\).*#\1#p')
[ -n "$RMA" ] || fail "no RMA number in the URL"
echo "created $RMA"
wait_text "Aktualny status: Zgłoszone"
wait_text "Skarpety"
shot 02-status
echo "PASS: $QA_ID ($RMA)"
