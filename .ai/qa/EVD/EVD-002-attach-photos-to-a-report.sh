#!/bin/sh
# EVD-002: photos are attached to a transport or missing report on submit, once and only from the same order, and a
# staged photo can be taken back before submit.
# Scenario: .ai/qa/EVD/EVD-002-attach-photos-to-a-report.md
# Priority: High. Type: API. Role: two guest customers (PL-10001, PL-10005) and the QA agent.
# Needs the ClamAV container (`docker compose up -d --wait clamav`). Creates reports; cleanup releases their units.
QA_ID=EVD-002
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

FX=$(mktemp -d)
node "$QA_DIR/lib/evidence-fixtures.mjs" "$FX" >/dev/null || fail "could not build the fixtures"
docker exec easyrms-clamav clamdcheck.sh >/dev/null 2>&1 || fail "the clamav container is not healthy (docker compose up -d --wait clamav)"
YESTERDAY=$(node -e 'console.log(new Date(Date.now()-864e5).toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"}))')
JAR_B="$COOKIES.guestB"
stage() { curl -s -b "$1" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$FX/${2:-ok.png}" | json_get data.id; }
report() { # <order line> <idempotency key> <ids as a JSON list>
  printf '{"kind":"transport","items":[{"lineRef":"%s","quantity":1}],"defectDescription":"Karton był zgnieciony, a produkt pęknięty.","defectDiscoveredOn":"%s","resolution":"replacement","evidenceFileIds":%s,"acknowledged":true,"idempotencyKey":"%s"}' "$1" "$YESTERDAY" "$3" "$2"
}
code_of() { curl -s -o "$FX/out.json" -w '%{http_code}' "$@"; }

step "two customers, one session each"
guest_lookup PL-10001 anna.kowalska@example.pl
curl -s -o /dev/null -c "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10005","email":"maria.lewandowska@example.pl"}'

step "negative: a report without photos is 400 on evidenceFileIds, an empty list too, and nothing is created"
for ids in '' '[]'; do
  if [ -z "$ids" ]; then
    BODY=$(report L1 "$(new_key)" '[]' | sed 's/"evidenceFileIds":\[\],//')
  else
    BODY=$(report L1 "$(new_key)" "$ids")
  fi
  code=$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$BODY")
  [ "$code" = 400 ] || fail "report without photos answered $code: $(cat "$FX/out.json")"
  grep -q 'evidenceFileIds' "$FX/out.json" || fail "the error does not name evidenceFileIds: $(cat "$FX/out.json")"
done

step "negative: seven photos, a repeated id and a malformed id are 400"
SEVEN='["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7"]'
for ids in "$SEVEN" '["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"]' '["../../etc/passwd"]'; do
  code=$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(report L1 "$(new_key)" "$ids")")
  [ "$code" = 400 ] || fail "bad ids answered $code for $ids"
done

step "negative: another customer's staged photo and an unknown id are refused with the same 400, and no report is left behind"
OTHERS=$(stage "$JAR_B")
[ -n "$OTHERS" ] || fail "could not stage the other customer's photo"
code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(report L1 "$(new_key)" "[\"$OTHERS\"]")" > "$FX/foreign.code"
cp "$FX/out.json" "$FX/foreign.json"
code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(report L1 "$(new_key)" '["00000000-0000-4000-8000-000000000000"]')" > "$FX/unknown.code"
[ "$(cat "$FX/foreign.code")" = 400 ] && [ "$(cat "$FX/unknown.code")" = 400 ] || fail "foreign/unknown answered $(cat "$FX/foreign.code")/$(cat "$FX/unknown.code")"
cmp -s "$FX/foreign.json" "$FX/out.json" || fail "the foreign-id and unknown-id answers differ, so a file id leaks its owner"
[ "$(db_sql "select count(*) from return_requests where order_number = 'PL-10001'")" = 0 ] || fail "a report was created although a photo was refused"
[ "$(db_sql "select count(*) from evidence_files where id = '$OTHERS' and return_request_id is null")" = 1 ] || fail "the other customer's photo was touched"

step "a staged photo can be taken back, only by its own session, and only before submit"
GONE=$(stage "$COOKIES.guest")
[ "$(code_of -b "$JAR_B" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$GONE")" = 404 ] || fail "another customer could delete the photo"
[ "$(code_of -X DELETE -H 'x-requested-with: fetch' "$BASE_URL/api/evidence/$GONE")" = 401 ] || fail "delete without a session was not 401"
[ "$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$GONE")" = 200 ] || fail "delete of an own staged photo failed"
[ "$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$GONE")" = 404 ] || fail "second delete was not 404"
[ "$(code_of -b "$COOKIES.guest" "$BASE_URL/api/evidence/$GONE")" = 404 ] || fail "a deleted photo can still be read"

step "a report with two photos is created and both are attached to it"
P1=$(stage "$COOKIES.guest" ok.png); P2=$(stage "$COOKIES.guest" ok.jpg)
[ -n "$P1" ] && [ -n "$P2" ] || fail "could not stage the photos"
KEY=$(new_key)
OUT=$(guest_submit "$(report L1 "$KEY" "[\"$P1\",\"$P2\"]")")
RMA=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "report not created: $OUT"
echo "created $RMA"
N=$(db_sql "select count(*) from evidence_files f join return_requests r on r.id = f.return_request_id where r.rma = '$RMA'")
[ "$N" = 2 ] || fail "expected 2 attached photos, found $N"

step "an idempotent replay returns the first report and attaches nothing more"
code=$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(report L1 "$KEY" "[\"$P1\",\"$P2\"]")")
[ "$code" = 200 ] || fail "replay answered $code"
grep -q '"rma":"'"$RMA"'"' "$FX/out.json" || fail "replay returned another report"
[ "$(db_sql "select count(*) from evidence_files where return_request_id is not null")" = 2 ] || fail "the replay changed the attached files"

step "negative: an attached photo cannot be removed, reused by another report, or changed"
[ "$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$P1")" = 404 ] || fail "an attached photo could be deleted"
code=$(code_of -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(report L1 "$(new_key)" "[\"$P1\"]")")
[ "$code" = 400 ] || fail "an attached photo was accepted for a second report ($code)"

step "the tracker and the agent see the thumbnails, and the image opens through the download route"
agent_login_api
RID=$(return_id_for "$RMA")
curl -s -b "$COOKIES.guest" "$BASE_URL/returns/$RMA" -o "$FX/tracker.html"
grep -q "/api/evidence/$P1" "$FX/tracker.html" && grep -q "/api/evidence/$P2" "$FX/tracker.html" || fail "the tracker page does not link both photos"
curl -s -b "$COOKIES" "$BASE_URL/admin/returns/$RID" -o "$FX/card.html"
grep -q "/api/evidence/$P1" "$FX/card.html" || fail "the decision card does not link the photo"
curl -s -b "$JAR_B" "$BASE_URL/returns/$RMA" -o "$FX/other.html" -w '%{http_code}' | grep -q 404 || fail "another order could open the tracker"
[ "$(code_of -b "$COOKIES" "$BASE_URL/api/evidence/$P2")" = 200 ] || fail "the agent could not open a photo"

step "a missing-item report takes photos the same way"
M1=$(stage "$JAR_B" ok.webp)
MB=$(printf '{"kind":"missing","items":[{"lineRef":"L1","quantity":1}],"defectDescription":"W paczce brakowało ładowarki do produktu.","defectDiscoveredOn":"%s","resolution":"resend_part","evidenceFileIds":["%s"],"acknowledged":true,"idempotencyKey":"%s"}' "$YESTERDAY" "$M1" "$(new_key)")
OUT=$(curl -s -b "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$MB")
RMA2=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA2" ] || fail "missing-item report not created: $OUT"
RMAS="$RMA2"

rm -rf "$FX"
echo "PASS: $QA_ID ($RMA, $RMA2)"
