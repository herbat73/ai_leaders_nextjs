#!/bin/sh
# SUP-003: an agent records that the supplier rejected a claim; the rejection needs a reason of enough characters.
# Scenario: .ai/qa/SUP/SUP-003-supplier-rejects-claim.md
# Priority: Medium. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: same as SUP-002 (supplier, received complaint with a confirmed defect on PL-10005 line L2, claim marked `sent`).
QA_ID=SUP-003
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
cleanup_extra() { cleanup_supplier; }
qa_init

step "setup: supplier, received complaint with a confirmed defect, sent claim"
agent_login_api
supplier_create
complaint_create PL-10005 maria.lewandowska@example.pl L2
complaint_to_received true
claim_create_sent

step "agent opens the claim page"
agent_login_ui
ab open "$BASE_URL/admin/supplier-claims/$CLAIM_ID" >/dev/null 2>&1 || fail "cannot open the claim page"
wait_text "Wysłano, czekamy na dostawcę"

step "negative: a rejection with a too short reason is refused"
click_role button "Dostawca odrzucił reklamację"
fill_label "Uzasadnienie dostawcy" "Za krótko"
click_role button "Zapisz odrzucenie"
wait_text "Podaj uzasadnienie (co najmniej"
expect_text "Wysłano, czekamy na dostawcę" "claim status changed despite the short reason"

step "a long enough reason records the rejection"
fill_label "Uzasadnienie dostawcy" "Dostawca twierdzi, że uszkodzenie powstało z winy użytkownika."
click_role button "Zapisz odrzucenie"
wait_text "Odrzucona przez dostawcę"
wait_text "Dostawca twierdzi, że uszkodzenie powstało z winy użytkownika."
expect_no_snap 'button "Nota kredytowa zaksięgowana"' "credit action offered for a rejected claim"
shot 01-rejected
echo "PASS: $QA_ID ($RMA)"
