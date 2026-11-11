#!/bin/sh
# RET-012: a missing-item report through the API, the 14-day window, the remedies per kind, and the agent decision.
# Scenario: .ai/qa/RET/RET-012-missing-item-and-window.md
# Priority: High. Type: API with an agent UI step. Role: guest customer, then agent (QA account with MANAGE_RULES).
# Order data: seeded PL-10001 (delivered 3 days ago, line L1) and PL-10003 (delivered 120 days ago).
QA_ID=RET-012
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

YESTERDAY=$(node -e 'console.log(new Date(Date.now()-864e5).toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"}))')
body() { # kind, resolution, lineRef
  printf '{"kind":"%s","items":[{"lineRef":"%s","quantity":1}],"defectDescription":"W paczce brakowało ładowarki do zamówionego produktu.","defectDiscoveredOn":"%s","resolution":"%s","acknowledged":true,"idempotencyKey":"%s"}' "$1" "$3" "$YESTERDAY" "$2" "$(new_key)"
}

step "negative: the window is 14 days, so PL-10003 (delivered 120 days ago) is refused"
guest_lookup PL-10003 ewa.wisniewska@example.pl
OUT=$(guest_submit "$(body missing resend_part L1)")
printf '%s' "$OUT" | grep -q 'outside_window' || fail "an old order was accepted: $OUT"

step "negative: resend_part is not a remedy of transport damage"
guest_lookup PL-10001 anna.kowalska@example.pl
OUT=$(guest_submit "$(body transport resend_part L1)")
printf '%s' "$OUT" | grep -q '"ok":true\|"rma"' && fail "resend_part accepted for transport: $OUT"
printf '%s' "$OUT" | grep -q 'validation_error' || fail "unexpected answer: $OUT"

step "a missing-item report with resend_part is accepted and has no amount"
OUT=$(guest_submit "$(body missing resend_part L1)")
RMA=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "missing-item report not created: $OUT"
printf '%s' "$OUT" | grep -q '"resolution":"resend_part"' || fail "remedy not echoed: $OUT"
echo "created $RMA"

step "the unit is held: the same line cannot be reported twice"
OUT=$(guest_submit "$(body transport replacement L1)")
printf '%s' "$OUT" | grep -q 'already_claimed' || fail "the held unit was accepted again: $OUT"

step "the agent sees the kind and approves, then resolves"
agent_login_ui
open_card "$RMA"
expect_text "Brak elementu" "kind missing on the card"
click_role button "Zatwierdź"
wait_text "Zatwierdzone"
click_role button "Zakończ"
wait_text "Zakończone"
shot 01-card-resolved

step "the inbox filters by the new kind"
ab open "$BASE_URL/admin/returns?kind=missing" >/dev/null 2>&1
wait_text "$RMA"
echo "PASS: $QA_ID ($RMA)"
