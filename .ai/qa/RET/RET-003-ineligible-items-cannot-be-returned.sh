#!/bin/sh
# RET-003: a non-returnable line is disabled with its reason, and an order that is not delivered offers no wizard.
# Scenario: .ai/qa/RET/RET-003-ineligible-items-cannot-be-returned.md
# Priority: High. Type: UI. Role: guest customer. Creates no return, so there is nothing to clean up.
# Order data: seeded PL-10002 (line "Bielizna termoaktywna" is not returnable) and PL-10004 (not delivered, has tracking).
QA_ID=RET-003
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "look up PL-10002 and start a return"
ab open "$BASE_URL/" >/dev/null 2>&1 || fail "cannot open $BASE_URL"
wait_text "Zwrot zamówienia"
fill_label "Numer zamówienia" "PL-10002"
fill_label "Adres e-mail" "jan.nowak@example.pl"
click_role button "Sprawdź zamówienie"
wait_url "**/returns"
click_role link "Rozpocznij zwrot"
wait_url "**/returns/new"
wait_text "Które produkty chcesz zwrócić?"

step "the non-returnable line is disabled and says why"
wait_text "Tego produktu nie można zwrócić"
snap | grep 'checkbox "Bielizna' | grep -q disabled || fail "the non-returnable line is selectable"
shot 01-ineligible-line

step "the returnable line stays selectable"
snap | grep 'checkbox "Kubek' | grep -vq disabled || fail "the returnable line is not selectable"

step "negative: continuing without any selection stays on the first step"
click_role button "Dalej"
wait_text "Które produkty chcesz zwrócić?"

step "an order that is not delivered offers no wizard but a tracking link"
ab open "$BASE_URL/returns" >/dev/null 2>&1
click_role button "Wyloguj"
wait_url "**/"
fill_label "Numer zamówienia" "PL-10004"
fill_label "Adres e-mail" "piotr.zielinski@example.pl"
click_role button "Sprawdź zamówienie"
wait_text "To zamówienie nie zostało jeszcze dostarczone"
wait_text "Śledź przesyłkę"
expect_no_snap 'link "Rozpocznij zwrot"' "return wizard offered for an undelivered order"
shot 02-not-delivered
echo "PASS: $QA_ID"
