#!/bin/sh
# CMP-003: an agent marks a received complaint "no defect": no supplier handover is offered and the complaint can be closed.
# Scenario: .ai/qa/CMP/CMP-003-agent-finds-no-defect.md
# Priority: Medium. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: the complaint is created through the API on seeded order PL-10005 (line L1, "Rękawiczki skórzane").
# Prerequisites and cleanup: see .ai/qa/lib/common.sh (a resolved complaint is released through db_release_rma).
QA_ID=CMP-003
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer files a complaint through the API"
complaint_create PL-10005 maria.lewandowska@example.pl L1

step "agent brings it to received"
agent_login_ui
open_card "$RMA"
click_role button "Zatwierdź"
wait_text "Zatwierdzone"
click_role button "Oznacz jako w drodze"
wait_text "W drodze"

step "received with no defect"
click_role button "Odebrane: brak wady"
wait_text "Brak wady"
shot 01-no-defect

step "negative: no supplier handover is offered for a complaint without a defect"
expect_no_text 'Reklamacja do dostawcy' "supplier section shown although no defect was confirmed"

step "the complaint continues to resolved"
click_role button "Zakończ"
wait_text "Zakończone"
shot 02-resolved
echo "PASS: $QA_ID ($RMA)"
