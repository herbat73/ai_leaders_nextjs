#!/bin/sh
# AGT-005: an agent opens the read-only customer-view preview of a return: banner, customer-facing status, no actions.
# Scenario: .ai/qa/AGT/AGT-005-agent-previews-customer-view.md
# Priority: Medium. Type: UI with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: a return is created through the API on seeded order PL-10001 (line L2); cleanup rejects it.
QA_ID=AGT-005
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer submits a return through the API"
guest_lookup PL-10001 anna.kowalska@example.pl
CREATED=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (unit held by an open request?): $CREATED"
echo "created $RMA"

step "agent opens the card and then the customer-view preview"
agent_login_ui
open_card "$RMA"
click_role link "Podgląd widoku klienta"
wait_url "**/customer-view"
wait_text "Podgląd widoku klienta — tylko do odczytu"
wait_text "$RMA"
wait_text "Aktualny status: Zgłoszone"
shot 01-preview

step "negative: the preview offers no decision actions"
expect_no_snap 'button "Zatwierdź"' "approve action shown in the read-only preview"
expect_no_snap 'button "Odrzuć"' "reject action shown in the read-only preview"

step "the preview links back to the card"
click_role link "← Wróć do karty zwrotu"
wait_text "Decyzja"
echo "PASS: $QA_ID ($RMA)"
