#!/bin/sh
# RET-008: the inbox filters by ?status=, an unknown filter falls back with a message, a non-numeric card id is a 404.
# Scenario: .ai/qa/RET/RET-008-inbox-filters-by-status.md
# Priority: Medium. Type: UI with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup: a return is created through the API on seeded order PL-10001 (line L2) and stays `submitted`; cleanup rejects it.
QA_ID=RET-008
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "setup: customer submits a return through the API"
guest_lookup PL-10001 anna.kowalska@example.pl
CREATED=$(guest_submit "{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$CREATED" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "setup: return not created (unit held by an open request?): $CREATED"
echo "created $RMA"

step "the submitted filter lists the new return"
agent_login_ui
ab open "$BASE_URL/admin/returns?status=submitted" >/dev/null 2>&1 || fail "cannot open the filtered inbox"
wait_text "$RMA"
shot 01-submitted

step "negative: the rejected filter does not list it"
ab open "$BASE_URL/admin/returns?status=rejected" >/dev/null 2>&1 || fail "cannot open the filtered inbox"
wait_text "Zwroty i reklamacje"
expect_no_text "$RMA" "$RMA listed under the rejected filter"

step "negative: an unknown filter shows everything with a message"
ab open "$BASE_URL/admin/returns?status=nie-ma-takiego" >/dev/null 2>&1 || fail "cannot open the inbox with a bad filter"
wait_text "Nieznany filtr, pokazuję wszystkie zgłoszenia."
wait_text "$RMA"

step "negative: a non-numeric card id is not found"
ab open "$BASE_URL/admin/returns/abc" >/dev/null 2>&1 || fail "cannot open the card with a bad id"
ab wait --text "404" >/dev/null 2>&1 || ab wait --text "could not be found" >/dev/null 2>&1 || fail "no not-found page for /admin/returns/abc"
shot 02-not-found
echo "PASS: $QA_ID ($RMA)"
