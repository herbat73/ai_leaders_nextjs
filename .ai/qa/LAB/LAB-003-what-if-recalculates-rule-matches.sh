#!/bin/sh
# LAB-003: the what-if form recalculates the rule matches with other thresholds; a bad threshold is refused.
# Scenario: .ai/qa/LAB/LAB-003-what-if-recalculates-rule-matches.md
# Priority: Medium. Type: UI. Role: agent (QA account). Nothing is stored by the page, so there is nothing to clean up.
# Same 10-case fixture as LAB-001: at the baseline threshold R08 (150 zł) matches 3 returns (89, 45 and 120 zł); with a
# 50 zł threshold only the 45 zł return matches.
QA_ID=LAB-003
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

step "agent imports the sample"
agent_login_ui
ab open "$BASE_URL/admin/discovery/case-sample" >/dev/null 2>&1 || fail "cannot open the lab"
wait_text "Próba przypadków"
ab upload "input[type=file]" "$CSV" >/dev/null 2>&1 || fail "cannot upload the CSV"
wait_text "Scenariusz z innymi progami"
tile() { ab eval "/$1/.test(document.body.innerText)" 2>&1 | tail -1 | grep -q true || fail "$2"; }
tile 'R08\s+tak\s+3' "R08 baseline matches are not 3"

step "negative: a threshold that is not an amount is refused"
fill_label "Próg R08 (zwrot, zł)" "abc"
click_role button "Przelicz ponownie"
wait_text "Popraw progi i spróbuj ponownie"

step "a 50 zł threshold leaves one R08 match in the scenario column"
fill_label "Próg R08 (zwrot, zł)" "50,00"
click_role button "Przelicz ponownie"
wait_text "Scenariusz:"
tile 'R08\s+tak\s+3\s+1' "R08 should match 3 cases at baseline and 1 in the scenario"
shot 01-what-if
echo "PASS: $QA_ID"
