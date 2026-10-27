#!/bin/sh
# LAB-001: an agent imports a CSV sample in the case sample lab and reads the calculated results.
# Scenario: .ai/qa/LAB/LAB-001-agent-imports-a-sample-and-reads-results.md
# Priority: Medium. Type: UI. Role: agent (QA account). Nothing is stored by the page, so there is nothing to clean up.
# The 10-case fixture is written to a temporary file with fixed values, so the expected counts never change.
QA_ID=LAB-001
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
CSV=$(mktemp)
cat > "$CSV" <<'CSVEOF'
case_ref,channel,kind,category,value_pln,opened_on,resolved_on,follow_up_requests,messages_exchanged,outcome
S01,mail,return,clothing,"89,00",2026-07-01,2026-07-04,2,5,approved
S02,phone,return,other,"349,99",2026-07-02,2026-07-03,0,2,approved
S03,mail,complaint,electronics,"1200,00",2026-07-02,2026-07-12,3,9,partial
S04,mail,return,clothing,"45,00",2026-07-03,2026-07-04,0,2,approved
S05,phone,complaint,other,"199,00",2026-07-05,2026-07-09,1,4,rejected
S06,mail,transport,electronics,"650,00",2026-07-06,,2,6,open
S07,mail,return,clothing,"120,00",2026-07-07,2026-07-08,0,2,approved
S08,phone,missing,home,"75,50",2026-07-08,2026-07-10,1,3,cancelled
S09,mail,return,other,"230,00",2026-07-09,2026-07-12,1,4,rejected
S10,mail,complaint,home,"89,90",2026-07-10,2026-07-15,2,6,approved
CSVEOF
cleanup_extra() { rm -f "$CSV"; }
qa_init

step "agent opens the lab"
agent_login_ui
ab open "$BASE_URL/admin/discovery/case-sample" >/dev/null 2>&1 || fail "cannot open the lab"
wait_text "Próba przypadków"
wait_text "Pobierz szablon CSV"
wait_text "Nic nie jest zapisywane."

step "import the sample"
ab upload "input[type=file]" "$CSV" >/dev/null 2>&1 || fail "cannot upload the CSV"
wait_text "Liczba spraw"
wait_text "Sprawy z dopytaniem"
wait_text "Mediana wiadomości"
shot 01-results

step "the tiles reflect the fixture: 10 cases, 70% with follow-ups, median 4 messages, 30% settled by a rule"
tile() { ab eval "/$1/.test(document.body.innerText)" 2>&1 | tail -1 | grep -q true || fail "$2"; }
tile 'Liczba spraw\s+10' "sample size tile is not 10"
tile 'Sprawy z dopytaniem\s+70%' "follow-up share is not 70%"
tile 'Mediana wiadomości\s+4' "median messages is not 4"
tile 'Rozstrzygnięte regułą\s+30%' "rule-settled share is not 30%"

step "the breakdowns and the rule table show the fixture counts"
tile 'Zwrot\s+5\s+50%' "return count is not 5"
tile 'Reklamacja\s+3\s+30%' "complaint count is not 3"
tile 'E-mail\s+7\s+70%' "mail channel count is not 7"
tile 'R08\s+tak\s+3' "R08 should match 3 cases at the baseline threshold"
tile 'R09\s+tak\s+0' "R09 should match 0 cases at the baseline threshold"

step "negative: the case table shows anonymous ids, never the source case references"
for id in C01 C06 C10; do expect_text "$id" "case $id missing from the table"; done
for id in S06 S10; do expect_no_text "$id" "source case reference $id leaked into the page"; done
echo "PASS: $QA_ID"
