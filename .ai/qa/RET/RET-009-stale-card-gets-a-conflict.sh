#!/bin/sh
# RET-009: a decision made on a stale card is refused with the current status, and the other agent's decision stands.
# Scenario: .ai/qa/RET/RET-009-stale-card-gets-a-conflict.md
# Priority: High. Type: UI with API setup. Role: agent (QA account with MANAGE_RULES); the "other agent" is an API call.
# Setup: a return is created through the API on seeded order PL-10001 (line L2). An approved return cannot be rejected through
# the API, so cleanup releases its unit in the disposable test database (see .ai/qa/lib/common.sh).
QA_ID=RET-009
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer submits a return through the API"
guest_lookup PL-10001 anna.kowalska@example.pl
CREATED=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (unit held by an open request?): $CREATED"
echo "created $RMA"

step "agent A opens the card while it is submitted"
agent_login_ui
open_card "$RMA"
expect_snap 'button "Zatwierdź"' "no approve button on a submitted return"

step "agent B approves the return meanwhile (API)"
agent_login_api
CID=$(return_id_for "$RMA")
[ "$(agent_move "$CID" approved)" = 200 ] || fail "the other agent could not approve"

step "negative: agent A approves from the stale card and gets a conflict with the current status"
click_role button "Zatwierdź"
wait_text "Status zgłoszenia zmienił się w międzyczasie. Aktualny status: Zatwierdzone."
shot 01-conflict

step "the other agent's decision stands after a reload"
ab open "$BASE_URL/admin/returns/$CID" >/dev/null 2>&1 || fail "cannot reopen the card"
wait_text "Zatwierdzone"
echo "PASS: $QA_ID ($RMA)"
