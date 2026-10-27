#!/bin/sh
# LAB-002: the lab rejects an invalid row (with line and column), a file with personal data, and a non-UTF-8 file.
# Scenario: .ai/qa/LAB/LAB-002-import-rejects-bad-files.md
# Priority: Medium. Type: UI. Role: agent (QA account). Nothing is stored by the page, so there is nothing to clean up.
QA_ID=LAB-002
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
HEADER='case_ref,channel,kind,category,value_pln,opened_on,resolved_on,follow_up_requests,messages_exchanged,outcome'
BAD_ROW=$(mktemp); PII=$(mktemp); LATIN=$(mktemp)
printf '%s\nS01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved\nS02,mail,return,nie-ma-takiej,"45,00",2026-07-02,2026-07-03,0,2,approved\n' "$HEADER" > "$BAD_ROW"
printf '%s\nS01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved\nS02,mail,return,clothing,"45,00",2026-07-02,2026-07-03,0,2,jan.nowak@example.pl\n' "$HEADER" > "$PII"
printf '%s\nS01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved\nS02,mail,return,\xff\xfe,"45,00",2026-07-02,2026-07-03,0,2,approved\n' "$HEADER" > "$LATIN"
cleanup_extra() { rm -f "$BAD_ROW" "$PII" "$LATIN"; }
qa_init

step "agent opens the lab"
agent_login_ui
ab open "$BASE_URL/admin/discovery/case-sample" >/dev/null 2>&1 || fail "cannot open the lab"
wait_text "Próba przypadków"

step "negative: an invalid category is reported with its line and column"
ab upload "input[type=file]" "$BAD_ROW" >/dev/null 2>&1 || fail "cannot upload the CSV"
wait_text "Plik zawiera błędy. Popraw je i wczytaj plik ponownie."
wait_text "Kategoria: electronics, appliances, home, clothing, hygiene lub other"
ab eval "/\\n3\\s+category/.test(document.body.innerText)" 2>&1 | tail -1 | grep -q true || fail "the error row does not point at line 3, column category"
expect_no_text "Liczba spraw" "results shown for a file with errors"
shot 01-row-error

step "negative: a file with personal data is rejected"
ab upload "input[type=file]" "$PII" >/dev/null 2>&1 || fail "cannot upload the CSV"
wait_text "Wiersz wygląda na dane osobowe"
expect_no_text "jan.nowak" "the personal data is echoed back on the page"
expect_no_text "Liczba spraw" "results shown for a file with personal data"
shot 02-personal-data

step "negative: a file that is not UTF-8 gets the encoding hint and no API call"
ab upload "input[type=file]" "$LATIN" >/dev/null 2>&1 || fail "cannot upload the CSV"
wait_text "Zapisz plik jako CSV UTF-8 i spróbuj ponownie"
expect_no_text "Liczba spraw" "results shown for a file with the wrong encoding"
shot 03-encoding
echo "PASS: $QA_ID"
