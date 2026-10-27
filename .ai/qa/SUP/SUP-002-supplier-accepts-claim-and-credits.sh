#!/bin/sh
# SUP-002: an agent records that the supplier accepted a claim (with a credit amount) and later that the credit note booked.
# Scenario: .ai/qa/SUP/SUP-002-supplier-accepts-claim-and-credits.md
# Priority: High. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: a supplier, a received complaint with a confirmed defect on PL-10005 (line L2, 49,00 zł), and its claim, which the
# script marks `sent` in the test database (see claim_create_sent in .ai/qa/lib/common.sh).
QA_ID=SUP-002
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
shot 01-sent

step "negative: an accepted claim needs a positive credit amount"
click_role button "Dostawca uznał reklamację"
click_role button "Zapisz uznanie"
wait_text "Podaj kwotę większą od zera"

step "negative: the credit cannot exceed the claimed products"
fill_label "Kwota noty kredytowej (zł)" "49,01"
click_role button "Zapisz uznanie"
wait_text "Kwota przekracza wartość reklamowanych produktów."

step "a valid amount records the acceptance"
fill_label "Kwota noty kredytowej (zł)" "20,00"
click_role button "Zapisz uznanie"
wait_text "Uznana, czeka na notę"
wait_text "20,00"
shot 02-accepted

step "the credit note booking closes the claim"
click_role button "Nota kredytowa zaksięgowana"
wait_text "Nota zaksięgowana"
expect_no_snap 'button "Nota kredytowa zaksięgowana"' "booking action still offered after crediting"
shot 03-credited
echo "PASS: $QA_ID ($RMA)"
