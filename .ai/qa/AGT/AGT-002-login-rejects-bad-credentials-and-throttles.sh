#!/bin/sh
# AGT-002: every login failure looks the same, repeated failures are throttled (429), and `next` cannot redirect off-site.
# Scenario: .ai/qa/AGT/AGT-002-login-rejects-bad-credentials-and-throttles.md
# Priority: High. Type: UI + API. Role: anonymous visitor, then the QA agent for the redirect check.
# Throttle budget: 10 attempts a minute per IP and 5 failures per 10 minutes per (e-mail, IP). The throttle check uses a
# unique unknown e-mail, so it never locks the QA account; this script makes 9 attempts, so wait a minute between runs.
QA_ID=AGT-002
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
GHOST="qa-ghost-$(date +%s)@example.test"
qa_init

step "negative: a wrong password and an unknown e-mail get the same message in the UI"
ab open "$BASE_URL/admin/login" >/dev/null 2>&1 || fail "cannot open the login page"
wait_text "Logowanie do panelu"
fill_label "E-mail" "$TEST_AGENT_EMAIL"
fill_label "Hasło" "zle-haslo-qa-1234"
click_role button "Zaloguj się"
wait_text "Nieprawidłowy e-mail lub hasło"
fill_label "E-mail" "$GHOST"
click_role button "Zaloguj się"
wait_text "Nieprawidłowy e-mail lub hasło"
expect_text "Logowanie do panelu" "left the login page after a failed login"
shot 01-neutral-error

step "the API gives the same 401 code for an unknown e-mail"
BODY=$(printf '{"email":"%s","password":"zle-haslo-qa-1234"}' "$GHOST" | api -w ' %{http_code}' -X POST "$BASE_URL/api/agents/login" --data-binary @-)
case "$BODY" in *invalid_credentials*401) ;; *) fail "expected 401 invalid_credentials, got: $BODY" ;; esac

step "five failures for one e-mail lead to 429 rate_limited"
for n in 1 2 3 4; do printf '{"email":"%s","password":"zle-haslo-qa-1234"}' "$GHOST" | api -o /dev/null -X POST "$BASE_URL/api/agents/login" --data-binary @-; done
CODE=$(printf '{"email":"%s","password":"zle-haslo-qa-1234"}' "$GHOST" | api -w '%{http_code}' -o /dev/null -X POST "$BASE_URL/api/agents/login" --data-binary @-)
[ "$CODE" = 429 ] || fail "expected 429 after repeated failures, got $CODE"

step "negative: a protocol-relative next parameter does not redirect off-site"
ab open "$BASE_URL/admin/login?next=//evil.example.test" >/dev/null 2>&1 || fail "cannot open the login page with next"
wait_text "Logowanie do panelu"
fill_label "E-mail" "$TEST_AGENT_EMAIL"
fill_label "Hasło" "$TEST_AGENT_PASSWORD"
click_role button "Zaloguj się"
ab wait --url "**/admin/**" >/dev/null 2>&1 || fail "login with a hostile next did not stay under /admin (at $(cur_url))"
case "$(cur_url)" in "$BASE_URL"/admin*) ;; *) fail "redirected off-site to $(cur_url)" ;; esac
shot 02-stayed-on-site
echo "PASS: $QA_ID"
