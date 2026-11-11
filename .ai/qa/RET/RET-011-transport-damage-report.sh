#!/bin/sh
# RET-011: a customer reports transport damage in the wizard (no photos in this phase), an agent approves and resolves it.
# Scenario: .ai/qa/RET/RET-011-transport-damage-report.md
# Priority: High. Type: UI. Role: guest customer, then agent (QA account with MANAGE_RULES).
# Order data: seeded PL-10001 / anna.kowalska@example.pl, delivered 3 days ago, line "Buty trekkingowe".
QA_ID=RET-011
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

YESTERDAY=$(node -e 'console.log(new Date(Date.now()-864e5).toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"}))')

step "look up the order and start a transport damage report"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"
fill_label "Numer zamówienia" "PL-10001"
fill_label "Adres e-mail" "anna.kowalska@example.pl"
click_role button "Sprawdź zamówienie"
wait_url "**/returns"
click_role link "Uszkodzenie w transporcie"
wait_url "**/returns/transport/new"
wait_text "Które produkty zostały uszkodzone?"

step "negative: continuing without an item stays on the first step"
click_role button "Dalej"
wait_text "Wybierz co najmniej jeden produkt."

step "pick the item, describe the damage"
ab find role checkbox click --name "Buty trekkingowe" >/dev/null 2>&1 || fail "item not selectable"
click_role button "Dalej"
wait_text "Opisz uszkodzenie"
step "negative: a short description does not pass"
fill_label "Co zostało uszkodzone?" "za krótko"
fill_date "$YESTERDAY"
click_role button "Dalej"
wait_text "Opisz problem w co najmniej 20 znakach."
fill_label "Co zostało uszkodzone?" "Karton był zgnieciony, a podeszwa buta pęknięta."
ab find role radio click --name "Tak" >/dev/null 2>&1 || fail "no courier note option"
click_role button "Dalej"

step "choose a remedy: only replacement and refund, no return method"
wait_text "Czego oczekujesz?"
expect_no_text "Dosłanie brakującego elementu" "resend_part offered for transport damage"
expect_no_text "Jak odeślesz" "a return method is asked for transport damage"
ab find role radio click --name "Wymiana na nowy egzemplarz" >/dev/null 2>&1 || fail "no replacement option"
click_role button "Dalej"
wait_text "Sprawdź i wyślij zgłoszenie"
shot 01-summary

step "confirm and submit"
ab find role checkbox click --name "Potwierdzam" >/dev/null 2>&1 || fail "no confirmation checkbox"
click_role button "Wyślij zgłoszenie uszkodzenia"
wait_url "**/returns/RMA-*"
RMA=$(cur_url | sed -n 's#.*/returns/\(RMA-[0-9]*-[0-9]*\).*#\1#p')
[ -n "$RMA" ] || fail "no RMA number in the URL"
echo "created $RMA"

step "the tracker shows three stages and the report"
wait_text "Aktualny status: Zgłoszone"
wait_text "Rozpatrzone"
wait_text "Rozwiązane"
expect_text "Karton był zgnieciony" "the description is missing on the tracker"
expect_text "Adnotacja kuriera" "the courier note is missing on the tracker"
shot 02-tracker

step "the agent approves and resolves it; there is no return leg"
agent_login_ui
open_card "$RMA"
expect_text "Uszkodzenie w transporcie" "kind missing on the card"
expect_text "Karton był zgnieciony" "description missing on the card"
expect_no_snap 'button "Oznacz jako w drodze"' "a return leg is offered"
click_role button "Zatwierdź"
wait_text "Zatwierdzone"
click_role button "Zakończ"
wait_text "Zakończone"
shot 03-card-resolved

step "the customer-facing view shows the report as resolved"
click_role link "Podgląd widoku klienta"
wait_text "Aktualny status: Zakończone"
echo "PASS: $QA_ID ($RMA)"
