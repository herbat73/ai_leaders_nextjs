#!/bin/sh
# RET-004: submitting the same idempotency key twice returns the original request: one RMA, status 201 then 200.
# Scenario: .ai/qa/RET/RET-004-repeated-submit-creates-one-return.md
# Priority: High. Type: API (customer session) with an agent-browser check of the result. Role: guest customer.
# The return is created on seeded order PL-10001 (line L2); cleanup rejects it.
QA_ID=RET-004
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

step "customer submits a return with a fresh idempotency key"
guest_lookup PL-10001 anna.kowalska@example.pl
KEY=$(new_key)
BODY="{\"items\":[{\"lineRef\":\"L2\",\"quantity\":1,\"reasonCode\":\"size\"}],\"resolution\":\"refund\",\"returnMethod\":\"store\",\"acknowledged\":true,\"idempotencyKey\":\"$KEY\"}"
FIRST=$(api -b "$COOKIES.guest" -w ' %{http_code}' -X POST "$BASE_URL/api/returns" --data-raw "$BODY")
case "$FIRST" in *' 201') ;; *) fail "expected 201 for the first submit, got: $FIRST" ;; esac
RMA=$(printf '%s' "$FIRST" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "no RMA in the first response: $FIRST"
echo "created $RMA"

step "the same request again returns the original (200, same RMA)"
SECOND=$(api -b "$COOKIES.guest" -w ' %{http_code}' -X POST "$BASE_URL/api/returns" --data-raw "$BODY")
case "$SECOND" in *' 200') ;; *) fail "expected 200 for the replay, got: $SECOND" ;; esac
printf '%s' "$SECOND" | grep -q "\"rma\":\"$RMA\"" || fail "the replay returned another RMA: $SECOND"

step "negative: a different key for the same, now held, line is a conflict (no second RMA)"
OTHER=$(api -b "$COOKIES.guest" -w ' %{http_code}' -X POST "$BASE_URL/api/returns" --data-raw "$(printf '%s' "$BODY" | sed "s/$KEY/$(new_key)/")")
case "$OTHER" in *' 409'|*' 400') ;; *) fail "expected 409/400 for the same line with a new key, got: $OTHER" ;; esac

step "the agent inbox lists the RMA exactly once"
agent_login_api
COUNT=$(agent_api "$BASE_URL/api/returns" | RMA="$RMA" node -e 'const d=JSON.parse(require("fs").readFileSync(0));const a=d.data.items||d.data;console.log(a.filter((x)=>x.rma===process.env.RMA).length)')
[ "$COUNT" = 1 ] || fail "expected one row for $RMA, got $COUNT"
echo "PASS: $QA_ID ($RMA)"
