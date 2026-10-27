#!/bin/sh
# CMP-001: customer files a complaint end to end (lookup -> complaint wizard -> RMA status page).
# Scenario: .ai/qa/CMP/CMP-001-customer-files-complaint.md
# Priority: High. Type: UI. Role: guest customer; an agent (QA account) is used only for cleanup.
# Order data: the app's fake order source (seeded PL-10005 / maria.lewandowska@example.pl, line "Czapka polarowa").
# Prerequisites and cleanup: see .ai/qa/lib/common.sh. Fail fast on the command line, never with per-test retries.
QA_ID=CMP-001
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
ORDER_NUMBER=PL-10005
ORDER_EMAIL=maria.lewandowska@example.pl
ITEM_NAME="Czapka polarowa"
DEFECT="Szew czapki rozpruł się po pierwszym praniu i materiał się strzępi."
qa_init

step "open the lookup page and look up the order"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"
fill_label "Numer zamówienia" "$ORDER_NUMBER"
fill_label "Adres e-mail" "$ORDER_EMAIL"
click_role button "Sprawdź zamówienie"
wait_url "**/returns"
wait_text "Twoje zgłoszenia"

step "start a complaint and pick the item"
click_role link "Zgłoś reklamację produktu"
wait_url "**/returns/complaint/new"
wait_text "Których produktów dotyczy reklamacja?"
ab find role checkbox click --name "$ITEM_NAME" >/dev/null 2>&1 || fail "item \"$ITEM_NAME\" not selectable"
click_role button "Dalej"
wait_text "Opisz wadę"
shot 01-defect-step

step "negative: a too short description does not leave the defect step"
fill_label "Co jest nie tak z produktem?" "Za krótko"
fill_date "$(date +%Y-%m-%d)"
click_role button "Dalej"
wait_text "Opisz wadę w co najmniej 20 znakach."

step "defect, return method, resolution"
fill_label "Co jest nie tak z produktem?" "$DEFECT"
click_role button "Dalej"
wait_text "Jak odeślesz produkt?"
ab find role radio click --name "Kurier" >/dev/null 2>&1 || fail "no courier option"
click_role button "Dalej"
wait_text "Czego oczekujesz?"
wait_text "Zgodnie z prawem w pierwszej kolejności przysługuje Ci naprawa lub wymiana."
ab find role radio click --name "Naprawa" >/dev/null 2>&1 || fail "no repair option"
click_role button "Dalej"
wait_text "Sprawdź i wyślij reklamację"
wait_text "$ITEM_NAME"
shot 02-summary

step "negative: submit without confirming stays on the summary"
click_role button "Wyślij reklamację"
wait_text "Zaznacz potwierdzenie, aby wysłać reklamację."

step "confirm and submit"
ab find role checkbox click --name "Potwierdzam" >/dev/null 2>&1 || fail "no confirmation checkbox"
click_role button "Wyślij reklamację"
wait_url "**/returns/RMA-*"
RMA=$(cur_url | sed -n 's#.*/returns/\(RMA-[0-9]*-[0-9]*\).*#\1#p')
[ -n "$RMA" ] || fail "no RMA number in the URL"
echo "created $RMA"

step "status page shows the complaint as submitted"
wait_text "Aktualny status: Zgłoszone"
wait_text "$ITEM_NAME"
shot 03-status
echo "PASS: $QA_ID ($RMA)"
