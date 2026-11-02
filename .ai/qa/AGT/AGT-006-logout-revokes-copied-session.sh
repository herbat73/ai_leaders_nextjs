#!/bin/sh
# AGT-006: logging out ends the session server-side, so a copied cookie (and the agent's other devices) stop working.
# Scenario: .ai/qa/AGT/AGT-006-logout-revokes-copied-session.md
# Priority: High (P0 security, threat T-05, issue #82). Type: API + UI. Role: the QA agent (MANAGE_RULES).
# Uses 3 logins and one logout of the QA account; logout ends every session of that account, so do not run it in
# parallel with another scenario.
QA_ID=AGT-006
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

JAR_A=$(mktemp)   # the laptop
JAR_B=$(mktemp)   # the phone
JAR_COPY=$(mktemp) # a copy of the laptop cookie, as an attacker would hold it
cleanup_extra() { rm -f "$JAR_A" "$JAR_B" "$JAR_COPY"; }

login_into() { printf '{"email":"%s","password":"%s"}' "$TEST_AGENT_EMAIL" "$TEST_AGENT_PASSWORD" |
  api -o /dev/null -w '%{http_code}' -c "$1" -X POST "$BASE_URL/api/agents/login" --data-binary @-; }
list_code() { api -o /dev/null -w '%{http_code}' -b "$1" "$BASE_URL/api/agents"; }

step "two devices log in and one cookie is copied"
[ "$(login_into "$JAR_A")" = 200 ] || fail "login on the first device did not answer 200 (throttled? wait a minute)"
[ "$(login_into "$JAR_B")" = 200 ] || fail "login on the second device did not answer 200"
cp "$JAR_A" "$JAR_COPY"
[ "$(list_code "$JAR_A")" = 200 ] || fail "the fresh session is not accepted"
[ "$(list_code "$JAR_COPY")" = 200 ] || fail "the copied cookie is not accepted before logout"

step "logout answers 200 and clears the cookie"
OUT=$(api -D - -o /dev/null -b "$JAR_A" -X POST "$BASE_URL/api/agents/logout")
echo "$OUT" | head -1 | grep -q 200 || fail "logout did not answer 200: $(echo "$OUT" | head -1)"
echo "$OUT" | grep -qi 'set-cookie: easyrms_agent=;' || echo "$OUT" | grep -qi 'set-cookie: easyrms_agent=.*max-age=0' || fail "logout did not clear the cookie"

step "negative: replaying the copied cookie is 401 on a read and on a second logout"
[ "$(list_code "$JAR_COPY")" = 401 ] || fail "the copied cookie still works after logout (expected 401)"
CODE=$(api -o /dev/null -w '%{http_code}' -b "$JAR_COPY" -X POST "$BASE_URL/api/agents/logout")
[ "$CODE" = 401 ] || fail "a second logout with the old cookie answered $CODE, expected 401"

step "the other device is signed out too (documented behaviour: logout ends all sessions)"
[ "$(list_code "$JAR_B")" = 401 ] || fail "the second device is still signed in after logout (expected 401)"

step "UI: the Wyloguj button signs out and a fresh login works again"
agent_login_ui
click_role button "Wyloguj"
ab wait --url "**/admin/login**" >/dev/null 2>&1 || fail "logout did not land on the login page (at $(cur_url))"
shot 01-after-logout
ab open "$BASE_URL/admin/returns" >/dev/null 2>&1 || fail "cannot open the inbox"
ab wait --url "**/admin/login**" >/dev/null 2>&1 || fail "the inbox is reachable after logout (at $(cur_url))"
agent_login_ui
expect_text "Zwroty i reklamacje" "fresh login after logout did not reach the inbox"
shot 02-fresh-login-works
echo "PASS: $QA_ID"
