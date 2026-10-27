#!/bin/sh
# RET-007: an agent moves a return through approved, in transit and received to resolved; the customer sees each result.
# Scenario: .ai/qa/RET/RET-007-agent-takes-a-return-to-resolved.md
# Priority: High. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: a return is created through the API on seeded order PL-10001 (line L2). A resolved return keeps its unit, so
# cleanup releases it in the disposable test database (see .ai/qa/lib/common.sh).
QA_ID=RET-007
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer submits a return through the API"
guest_lookup PL-10001 anna.kowalska@example.pl
CREATED=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (unit held by an open request?): $CREATED"
echo "created $RMA"

step "agent opens the card"
agent_login_ui
open_card "$RMA"

step "approve, in transit, received, resolved"
click_role button "Zatwierdź"
wait_text "Zatwierdzone"
click_role button "Oznacz jako w drodze"
wait_text "W drodze"
click_role button "Oznacz jako odebrane"
wait_text "Odebrane"
click_role button "Zakończ"
wait_text "Zakończone"
shot 01-resolved

step "the timeline records every move and the card offers no further action"
for label in "Zgłoszenie utworzone" "Zatwierdzone" "W drodze" "Odebrane" "Zakończone"; do expect_text "$label" "timeline entry \"$label\" missing"; done
wait_text "Dla tego statusu nie ma dostępnych akcji."

step "the customer-facing view shows the return as resolved"
click_role link "Podgląd widoku klienta"
wait_text "Aktualny status: Zakończone"
shot 02-customer-view
echo "PASS: $QA_ID ($RMA)"
