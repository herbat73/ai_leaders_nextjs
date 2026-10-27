#!/bin/sh
# CMP-002: an agent takes a complaint through approved -> in transit -> received and confirms the defect.
# Scenario: .ai/qa/CMP/CMP-002-agent-confirms-defect.md
# Priority: High. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: the complaint is created through the API on seeded order PL-10005 (line L2, "Czapka polarowa").
# Prerequisites and cleanup: see .ai/qa/lib/common.sh. A received complaint cannot be rejected through the API, so
# cleanup releases its unit directly in the disposable test database (db_release_rma).
QA_ID=CMP-002
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer files a complaint through the API"
complaint_create PL-10005 maria.lewandowska@example.pl L2

step "agent signs in and finds the complaint in the inbox as a complaint"
agent_login_ui
open_card "$RMA"
wait_text "Opis wady"
wait_text "Jeszcze nie oceniono"
shot 01-card-submitted

step "negative: defect assessment is not offered before the item is received"
expect_no_snap 'button "Odebrane: wada potwierdzona"' "defect buttons shown before received"

step "approve, mark in transit, then received with a confirmed defect"
click_role button "Zatwierdź"
wait_text "Zatwierdzone"
click_role button "Oznacz jako w drodze"
wait_text "W drodze"
expect_snap 'button "Odebrane: wada potwierdzona"' "no confirm-defect button once in transit"
click_role button "Odebrane: wada potwierdzona"
wait_text "Wada potwierdzona"
shot 02-defect-confirmed

step "the supplier handover section is offered for a confirmed defect"
wait_text "Reklamacja do dostawcy"
echo "PASS: $QA_ID ($RMA)"
