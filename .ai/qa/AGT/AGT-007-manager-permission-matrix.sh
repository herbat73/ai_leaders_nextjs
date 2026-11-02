#!/bin/sh
# AGT-007: the manager-permission matrix. A plain agent (no MANAGE_RULES) gets 403 on every manager-only API action, a
# manager is let through (never 403), and every signed-in agent can still use the shared routes.
# Scenario: .ai/qa/AGT/AGT-007-manager-permission-matrix.md
# Priority: High (P1 security, threat T-06, issue #83). Type: API. Roles: the QA manager and a throw-away plain agent.
# Side-effect free for the manager: it sends empty bodies and unknown ids, so a passed permission check shows as 400/404.
QA_ID=AGT-007
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
NEW_EMAIL="qa-matrix-$(date +%s)@example.test"
NEW_PASSWORD="Qa-$(node -e 'console.log(require("crypto").randomBytes(12).toString("base64url"))')"
PLAIN_JAR=$(mktemp)
cleanup_extra() { disable_agent_by_email "$NEW_EMAIL"; rm -f "$PLAIN_JAR"; }
qa_init

step "setup: invite an agent without permissions and accept the invite (API)"
agent_login_api
INVITE=$(agent_api -X POST "$BASE_URL/api/agents" --data-raw "{\"email\":\"$NEW_EMAIL\",\"displayName\":\"QA Matrix\",\"permissions\":[]}")
TOKEN=$(printf '%s' "$INVITE" | json_get data.inviteToken)
[ -n "$TOKEN" ] || fail "setup: invite not created: $INVITE"
CODE=$(api -o /dev/null -w '%{http_code}' -c "$PLAIN_JAR" -X POST "$BASE_URL/api/agents/invite/accept" --data-raw "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASSWORD\"}")
[ "$CODE" = 200 ] || fail "setup: invite not accepted ($CODE)"

plain_code() { api -o /dev/null -w '%{http_code}' -b "$PLAIN_JAR" -X "$1" "$BASE_URL$2" --data-raw "$3"; }
manager_code() { agent_api -o /dev/null -w '%{http_code}' -X "$1" "$BASE_URL$2" --data-raw "$3"; }

# method path body  -> manager-only actions. The body is empty/invalid and the id unknown on purpose.
check_manager_only() {
  c=$(plain_code "$1" "$2" "$3");   [ "$c" = 403 ] || fail "plain agent: $1 $2 answered $c, expected 403"
  c=$(manager_code "$1" "$2" "$3"); [ "$c" != 403 ] && [ "$c" != 401 ] || fail "manager: $1 $2 answered $c, expected the permission check to pass"
  echo "ok  $1 $2  plain=403 manager=$c"
}
# method path body -> shared actions: a plain agent must get past the permission check too (any status but 401/403).
check_any_agent() {
  c=$(plain_code "$1" "$2" "$3"); [ "$c" != 403 ] && [ "$c" != 401 ] || fail "plain agent: $1 $2 answered $c, expected access"
  echo "ok  $1 $2  plain=$c"
}

step "manager-only actions: plain agent 403, manager through"
check_manager_only GET   /api/agents ''
check_manager_only POST  /api/agents '{}'
check_manager_only PATCH /api/agents/999999 '{"status":"disabled"}'
check_manager_only POST  /api/suppliers '{}'
check_manager_only PATCH /api/suppliers/999999 '{"active":false}'

step "shared actions: a plain agent keeps access"
check_any_agent GET   /api/suppliers ''
check_any_agent GET   /api/supplier-claims ''
check_any_agent POST  /api/supplier-claims '{}'
check_any_agent PATCH /api/supplier-claims/999999 '{}'
check_any_agent POST  /api/supplier-claims/999999/send ''
check_any_agent GET   /api/returns ''
check_any_agent PATCH /api/returns/999999 '{}'

step "negative: no session at all is 401 on a manager-only route"
c=$(api -o /dev/null -w '%{http_code}' "$BASE_URL/api/agents")
[ "$c" = 401 ] || fail "GET /api/agents without a session answered $c, expected 401"

step "the approve-over-limit move of PATCH /api/returns/[id] is covered by return.service.test.ts (no seeded refund reaches the limit)"
echo "PASS: $QA_ID ($NEW_EMAIL)"
