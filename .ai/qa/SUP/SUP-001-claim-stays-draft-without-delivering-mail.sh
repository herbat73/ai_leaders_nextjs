#!/bin/sh
# SUP-001: with a non-delivering mail transport (the default `log`) a supplier claim is saved as a draft, never as sent.
# Scenario: .ai/qa/SUP/SUP-001-claim-stays-draft-without-delivering-mail.md
# Priority: High. Type: UI (agent side) with API setup. Role: agent (QA account with MANAGE_RULES).
# Setup through the API: a supplier with a unique name and a complaint on seeded order PL-10005 (line L2) brought to
# `received` with a confirmed defect. Requires the test env to run with the default log mail transport.
# Prerequisites and cleanup: see .ai/qa/lib/common.sh (supplier deactivated, complaint released in the test database).
QA_ID=SUP-001
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
cleanup_extra() { cleanup_supplier; }
qa_init

step "setup: supplier and a received complaint with a confirmed defect (API)"
agent_login_api
supplier_create
complaint_create PL-10005 maria.lewandowska@example.pl L2
complaint_to_received true

step "agent opens the card and sees the supplier section"
agent_login_ui
open_card "$RMA"
wait_text "Reklamacja do dostawcy"
shot 01-section

step "negative: sending without choosing a supplier is refused"
click_role button "Wyślij reklamację do dostawcy"
wait_text "Wybierz dostawcę."

step "choose the supplier; the card warns that mail is not delivered"
click_role combobox "Dostawca"
ab find role option click --name "$SUPPLIER_NAME" >/dev/null 2>&1 || fail "supplier \"$SUPPLIER_NAME\" not offered"
wait_listbox_closed
wait_text "Poczta nie dostarcza wiadomości: reklamacja zostanie zapisana jako szkic."
wait_text "Wymagane wideo wady."

step "send: the claim is saved as a draft, not as sent"
click_role button "Wyślij reklamację do dostawcy"
wait_text "Szkic, nie wysłano"
wait_text "Otwórz reklamację"
shot 02-draft

step "the claim page shows it was not sent and a retry is refused"
click_role link "Otwórz reklamację"
wait_text "Szkic, nie wysłano"
wait_text "Wiadomość nie została wysłana do dostawcy."
click_role button "Wyślij ponownie"
wait_text "Poczta nie jest skonfigurowana do wysyłki"
expect_no_text "Wysłano, czekamy na dostawcę" "claim marked sent without a delivering transport"
shot 03-claim-draft

step "the supplier claim list shows it as a draft"
ab open "$BASE_URL/admin/supplier-claims" >/dev/null 2>&1 || fail "cannot open the claim list"
wait_text "Szkic, nie wysłano"
echo "PASS: $QA_ID ($RMA)"
