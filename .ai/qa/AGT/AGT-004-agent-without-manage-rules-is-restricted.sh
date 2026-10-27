#!/bin/sh
# AGT-004: an agent without the manage permission works the inbox but cannot reach agent management (page and API).
# Scenario: .ai/qa/AGT/AGT-004-agent-without-manage-rules-is-restricted.md
# Priority: High. Type: UI + API. Role: a throw-away agent without MANAGE_RULES (invited and accepted through the API).
# The refund-approval limit (R11) is not covered here: it needs a refund above EASYRMS_REFUND_APPROVAL_LIMIT (2000 zł by
# default) and the seeded orders never reach it; see the scenario file.
QA_ID=AGT-004
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
NEW_EMAIL="qa-plain-$(date +%s)@example.test"
NEW_PASSWORD="Qa-$(node -e 'console.log(require("crypto").randomBytes(12).toString("base64url"))')"
PLAIN_JAR=$(mktemp)
cleanup_extra() { disable_agent_by_email "$NEW_EMAIL"; rm -f "$PLAIN_JAR"; }
qa_init

step "setup: invite an agent without permissions and accept the invite (API)"
agent_login_api
INVITE=$(agent_api -X POST "$BASE_URL/api/agents" --data-raw "{\"email\":\"$NEW_EMAIL\",\"displayName\":\"QA Bez Uprawnien\",\"permissions\":[]}")
TOKEN=$(printf '%s' "$INVITE" | json_get data.inviteToken)
[ -n "$TOKEN" ] || fail "setup: invite not created: $INVITE"
CODE=$(api -o /dev/null -w '%{http_code}' -c "$PLAIN_JAR" -X POST "$BASE_URL/api/agents/invite/accept" --data-raw "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASSWORD\"}")
[ "$CODE" = 200 ] || fail "setup: invite not accepted ($CODE)"

step "the agent signs in through the browser and reaches the inbox"
login_ui_as "$NEW_EMAIL" "$NEW_PASSWORD"

step "negative: the navigation offers no agent management"
expect_no_snap 'link "Agenci"' "the Agenci link is shown to an agent without the manage permission"

step "negative: the agents page shows no access"
ab open "$BASE_URL/admin/agents" >/dev/null 2>&1 || fail "cannot open the agents page"
wait_text "Brak uprawnień"
expect_no_text "Zaproś agenta" "the invite action is offered to an agent without the permission"
shot 01-forbidden

step "negative: the agents API answers 403"
CODE=$(api -o /dev/null -w '%{http_code}' -b "$PLAIN_JAR" "$BASE_URL/api/agents")
[ "$CODE" = 403 ] || fail "expected 403 from GET /api/agents, got $CODE"
echo "PASS: $QA_ID ($NEW_EMAIL)"
