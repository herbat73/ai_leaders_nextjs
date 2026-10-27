#!/bin/sh
# AGT-001: a manager invites a new agent, the invitee sets a password and signs in; the one-time link works once.
# Scenario: .ai/qa/AGT/AGT-001-manager-invites-agent.md
# Priority: High. Type: UI, two browser sessions. Role: manager (QA account with MANAGE_RULES) and the invited agent.
# The invited e-mail is unique per run and the account is disabled in cleanup (agents are never deleted).
QA_ID=AGT-001
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
NEW_EMAIL="qa-invitee-$(date +%s)@example.test"
NEW_NAME="QA Zaproszony"
NEW_PASSWORD="Qa-$(node -e 'console.log(require("crypto").randomBytes(12).toString("base64url"))')"
cleanup_extra() { disable_agent_by_email "$NEW_EMAIL"; }
qa_init

step "manager opens the agents page"
agent_login_ui
ab open "$BASE_URL/admin/agents" >/dev/null 2>&1 || fail "cannot open the agents page"
wait_text "Konta agentów"

step "negative: an invitation without an e-mail is refused"
click_role button "Zaproś agenta"
click_role button "Wyślij zaproszenie"
wait_text "Podaj adres e-mail."

step "invite the new agent; the one-time link is shown"
fill_label "E-mail" "$NEW_EMAIL"
fill_label "Imię i nazwisko" "$NEW_NAME"
click_role button "Wyślij zaproszenie"
wait_text "Zaproszenie gotowe"
wait_text "Link widzisz tylko raz"
INVITE_URL=$(ab eval "[...document.querySelectorAll('input,textarea,code,p,span')].map((e)=>e.value||e.textContent).find((v)=>v&&v.includes('/admin/invite/'))" 2>&1 | tail -1 | tr -d '"')
case "$INVITE_URL" in */admin/invite/*) ;; *) fail "invite link not found on the page (got: $INVITE_URL)" ;; esac
shot 01-invite-link

step "invitee opens the link in another session and sets a password"
ab2 open "$INVITE_URL" >/dev/null 2>&1 || fail "cannot open the invite link"
"$AB" --session "$SESSION-2" wait --text "Ustaw hasło" >/dev/null 2>&1 || fail "invite page did not load"
step "negative: a too short password is refused"
"$AB" --session "$SESSION-2" find label "Hasło" fill "krotkie" >/dev/null 2>&1 || fail "no password field"
"$AB" --session "$SESSION-2" find role button click --name "Ustaw hasło i zaloguj się" >/dev/null 2>&1 || fail "no submit button"
"$AB" --session "$SESSION-2" wait --text "Hasło musi mieć co najmniej" >/dev/null 2>&1 || fail "no too-short message"
"$AB" --session "$SESSION-2" find label "Hasło" fill "$NEW_PASSWORD" >/dev/null 2>&1 || fail "no password field"
"$AB" --session "$SESSION-2" find role button click --name "Ustaw hasło i zaloguj się" >/dev/null 2>&1 || fail "no submit button"
"$AB" --session "$SESSION-2" wait --url "**/admin/returns" >/dev/null 2>&1 || fail "accepting the invite did not sign the agent in"
"$AB" --session "$SESSION-2" wait --text "$NEW_NAME" >/dev/null 2>&1 || fail "agent name not shown in the header"
"$AB" --session "$SESSION-2" screenshot --full "$ART_DIR/02-invitee-signed-in.png" >/dev/null 2>&1 || true

step "negative: the same token cannot be accepted twice (invite_invalid)"
TOKEN=${INVITE_URL##*/}
REUSE=$(api -X POST "$BASE_URL/api/agents/invite/accept" --data-raw "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASSWORD\"}")
printf '%s' "$REUSE" | grep -q '"code":"invite_invalid"' || fail "used token not rejected with invite_invalid: $REUSE"

step "the manager sees the new agent as active"
ab open "$BASE_URL/admin/agents" >/dev/null 2>&1 || fail "cannot reopen the agents page"
wait_text "$NEW_EMAIL"
echo "PASS: $QA_ID ($NEW_EMAIL)"
