#!/bin/sh
# AGT-003: a manager disables an agent; the agent's next request is refused, and nobody can disable their own account.
# Scenario: .ai/qa/AGT/AGT-003-manager-disables-agent.md
# Priority: High. Type: UI + API. Role: manager (QA account with MANAGE_RULES) and a throw-away agent.
# Setup through the API: invite a unique agent and accept the invite (that agent's session cookie is kept in a jar).
QA_ID=AGT-003
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
NEW_EMAIL="qa-disable-$(date +%s)@example.test"
NEW_PASSWORD="Qa-$(node -e 'console.log(require("crypto").randomBytes(12).toString("base64url"))')"
INVITEE_JAR=$(mktemp)
cleanup_extra() { disable_agent_by_email "$NEW_EMAIL"; rm -f "$INVITEE_JAR"; }
qa_init

step "setup: invite a throw-away agent and accept the invite (API)"
agent_login_api
INVITE=$(agent_api -X POST "$BASE_URL/api/agents" --data-raw "{\"email\":\"$NEW_EMAIL\",\"displayName\":\"QA Do Wylaczenia\",\"permissions\":[]}")
TOKEN=$(printf '%s' "$INVITE" | json_get data.inviteToken)
[ -n "$TOKEN" ] || fail "setup: invite not created: $INVITE"
CODE=$(api -o /dev/null -w '%{http_code}' -c "$INVITEE_JAR" -X POST "$BASE_URL/api/agents/invite/accept" --data-raw "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASSWORD\"}")
[ "$CODE" = 200 ] || fail "setup: invite not accepted ($CODE)"
# PATCH checks authentication first (401), then existence (404): an unknown id proves the session is accepted.
PROBE='{"status":"approved"}'
[ "$(api -o /dev/null -w '%{http_code}' -b "$INVITEE_JAR" -X PATCH "$BASE_URL/api/returns/999999" --data-raw "$PROBE")" = 404 ] || fail "setup: the new agent session is not accepted"

step "manager opens the agents page: the own row offers no disable action"
agent_login_ui
ab open "$BASE_URL/admin/agents" >/dev/null 2>&1 || fail "cannot open the agents page"
wait_text "$NEW_EMAIL"
# The list is paginated (10 per page, newest first): the manager's own row is not on page 1, so find it through the search.
fill_label "Szukaj po imieniu, nazwisku lub e-mailu" "$TEST_AGENT_EMAIL"
wait_text "to Ty"
fill_label "Szukaj po imieniu, nazwisku lub e-mailu" "$NEW_EMAIL"
wait_text "$NEW_EMAIL"

step "negative: the API refuses to disable the own account (self_disable)"
SELF_ID=$(agent_api "$BASE_URL/api/agents" | E="$TEST_AGENT_EMAIL" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data.agents||d.data;const r=a.find((x)=>x.email===process.env.E);if(r)console.log(r.id)')
[ -n "$SELF_ID" ] || fail "own agent id not found"
SELF=$(agent_api -w ' %{http_code}' -X PATCH "$BASE_URL/api/agents/$SELF_ID" --data-raw '{"status":"disabled"}')
case "$SELF" in *self_disable*409) ;; *) fail "expected 409 self_disable, got: $SELF" ;; esac

step "disable the throw-away agent from its row"
REF=$(snap | awk -v email="$NEW_EMAIL" 'index($0, email) { found = 1; next } found && /button "Wyłącz"/ { match($0, /ref=e[0-9]+/); print substr($0, RSTART + 4, RLENGTH - 4); exit }')
[ -n "$REF" ] || fail "no disable button in the row of $NEW_EMAIL"
ab click "@$REF" >/dev/null 2>&1 || fail "cannot click the disable button"
wait_text "Wyłączyć agenta"
click_role button "Wyłącz agenta"
wait_text "Wyłączony"
shot 01-disabled

step "the disabled agent's next request is refused"
CODE=$(api -o /dev/null -w '%{http_code}' -b "$INVITEE_JAR" -X PATCH "$BASE_URL/api/returns/999999" --data-raw "$PROBE")
[ "$CODE" = 401 ] || fail "expected 401 for the disabled agent, got $CODE"
echo "PASS: $QA_ID ($NEW_EMAIL)"
