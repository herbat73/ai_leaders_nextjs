#!/bin/sh
# RET-013: retention and erasure (T-21): `npm run retention:run` anonymizes a request that has been closed for longer than
# the retention period and leaves an open one alone; the agent card and list show the erasure.
# Scenario: .ai/qa/RET/RET-013-retention-and-erasure.md
# Priority: High. Type: UI (agent side) + CLI, with API setup. Role: two guest customers (PL-10001, PL-10005) and the QA agent.
# Needs the ClamAV container (`docker compose up -d --wait clamav`). The requests are backdated by SQL on the disposable
# test database; cleanup releases their units.
QA_ID=RET-013
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

FX=$(mktemp -d)
node "$QA_DIR/lib/evidence-fixtures.mjs" "$FX" >/dev/null || fail "could not build the fixtures"
docker exec easyrms-clamav clamdcheck.sh >/dev/null 2>&1 || fail "the clamav container is not healthy (docker compose up -d --wait clamav)"
YESTERDAY=$(node -e 'console.log(new Date(Date.now()-864e5).toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"}))')
JAR_B="$COOKIES.guestB"
DEFECT_A="Karton byl zgnieciony, a produkt pekniety, RET013-A."
stage() { curl -s -b "$1" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$FX/${2:-ok.png}" | json_get data.id; }
# Runs a command from the repository root against the test database.
job() { (cd "$ROOT" && EASYRMS_DATABASE_URL="$QA_DB_URL" "$@" 2>&1); }
sql() { db_sql "$1"; }

step "two customers, one report each, each with a scanned photo"
guest_lookup PL-10001 anna.kowalska@example.pl
curl -s -o /dev/null -c "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10005","email":"maria.lewandowska@example.pl"}'
PA=$(stage "$COOKIES.guest" ok.png); PB=$(stage "$JAR_B" ok.webp)
[ -n "$PA" ] && [ -n "$PB" ] || fail "could not stage the photos"
OUT=$(guest_submit "$(printf '{"kind":"transport","items":[{"lineRef":"L1","quantity":1}],"defectDescription":"%s","defectDiscoveredOn":"%s","resolution":"replacement","evidenceFileIds":["%s"],"acknowledged":true,"idempotencyKey":"%s"}' "$DEFECT_A" "$YESTERDAY" "$PA" "$(new_key)")")
RMA_A=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p'); [ -n "$RMA_A" ] || fail "report A not created: $OUT"
OUT=$(curl -s -b "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns" --data-raw "$(printf '{"kind":"missing","items":[{"lineRef":"L1","quantity":1}],"defectDescription":"W paczce brakowalo ladowarki, RET013-B.","defectDiscoveredOn":"%s","resolution":"resend_part","evidenceFileIds":["%s"],"acknowledged":true,"idempotencyKey":"%s"}' "$YESTERDAY" "$PB" "$(new_key)")")
RMA_B=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p'); [ -n "$RMA_B" ] || fail "report B not created: $OUT"
RMA=$RMA_A; RMAS=$RMA_B
echo "A=$RMA_A (to be closed) B=$RMA_B (left open)"

step "the agent closes A (approved, then resolved); B stays submitted"
agent_login_api
ID_A=$(return_id_for "$RMA_A"); ID_B=$(return_id_for "$RMA_B")
[ "$(agent_move "$ID_A" approved)" = 200 ] || fail "approve A failed"
[ "$(agent_move "$ID_A" resolved)" = 200 ] || fail "resolve A failed"

step "before: the card of A shows the e-mail, the defect text and the photo"
agent_login_ui
ab open "$BASE_URL/admin/returns/$ID_A" >/dev/null 2>&1 || fail "cannot open card A"
wait_text "anna.kowalska@example.pl"
expect_text "RET013-A" "card A lacks the defect text before retention"
curl -s -b "$COOKIES" "$BASE_URL/admin/returns/$ID_A" -o "$FX/cardA-before.html"
grep -q "/api/evidence/$PA" "$FX/cardA-before.html" || fail "card A does not link the photo before retention"
shot 01-card-closed-before
ab open "$BASE_URL/admin/returns" >/dev/null 2>&1 || fail "cannot open the inbox"
wait_text "anna.kowalska@example.pl"
shot 02-inbox-before

step "both requests are 400 days old (their events are backdated)"
sql "update return_request_events set created_at = now() - interval '400 days' where return_request_id in ($ID_A, $ID_B)" >/dev/null
sql "update evidence_files set created_at = now() - interval '400 days' where id in ('$PA', '$PB')" >/dev/null
[ "$(sql "select count(*) from evidence_files where return_request_id = $ID_A")" = 1 ] || fail "A should have one photo"
[ "$(sql "select count(*) from evidence_audit_events where return_request_id = $ID_A")" -ge 1 ] || fail "A should have audit rows"

step "a dry run lists A only and changes nothing"
OUT=$(job npm run retention:run -- --dry-run) || fail "dry run failed: $OUT"
echo "$OUT" | grep -q "would anonymize 1 request" || fail "dry run did not report 1 request: $OUT"
echo "$OUT" | grep -q "$RMA_A" || fail "dry run did not list $RMA_A: $OUT"
echo "$OUT" | grep -q "$RMA_B" && fail "dry run listed the open request $RMA_B"
[ "$(sql "select count(*) from return_requests where id = $ID_A and anonymized_at is null and customer_email = 'anna.kowalska@example.pl'")" = 1 ] || fail "the dry run changed A"
[ "$(sql "select count(*) from evidence_files where return_request_id = $ID_A")" = 1 ] || fail "the dry run deleted the photo"

step "negative: an invalid EASYRMS_RETENTION_DAYS is refused and deletes nothing"
set +e; OUT=$(cd "$ROOT" && EASYRMS_DATABASE_URL="$QA_DB_URL" EASYRMS_RETENTION_DAYS=7 npm run retention:run 2>&1); RC=$?; set -e
[ "$RC" -ne 0 ] && echo "$OUT" | grep -q "must be a whole number from 30 to 3650" || fail "a bad setting was not refused (rc=$RC): $OUT"
[ "$(sql "select count(*) from return_requests where anonymized_at is not null")" = 0 ] || fail "a bad setting still erased something"

step "negative: a period longer than the age of the requests erases nothing (EASYRMS_RETENTION_DAYS=500)"
OUT=$(cd "$ROOT" && EASYRMS_DATABASE_URL="$QA_DB_URL" EASYRMS_RETENTION_DAYS=500 npm run retention:run 2>&1) || fail "run with 500 days failed: $OUT"
echo "$OUT" | grep -q "anonymized 0 request" || fail "500 days should leave 400-day-old requests: $OUT"

step "the real run (default 365 days) anonymizes A and leaves the open B"
OUT=$(job npm run retention:run) || fail "retention run failed: $OUT"
echo "$OUT"
echo "$OUT" | grep -q "anonymized 1 request" || fail "expected 1 anonymized request"
[ "$(sql "select count(*) from return_requests where id = $ID_A and customer_email = 'erased-$RMA_A@anonymized.invalid' and anonymized_at is not null and defect_description is null and reason is null")" = 1 ] || fail "A was not anonymized"
[ "$(sql "select count(*) from evidence_files where return_request_id = $ID_A")" = 0 ] || fail "A's photo is still stored"
[ "$(sql "select count(*) from evidence_audit_events where return_request_id = $ID_A or evidence_file_id = '$PA'")" = 0 ] || fail "A's audit rows are still stored"
[ "$(sql "select count(*) from return_requests where id = $ID_B and anonymized_at is null and customer_email = 'maria.lewandowska@example.pl' and defect_description is not null")" = 1 ] || fail "B (open) was touched"
[ "$(sql "select count(*) from evidence_files where return_request_id = $ID_B")" = 1 ] || fail "B's photo was deleted"
[ "$(sql "select order_number || status from return_requests where id = $ID_A")" = "PL-10001resolved" ] || fail "A lost its order number or status"

step "a rerun does nothing"
OUT=$(job npm run retention:run) || fail "rerun failed: $OUT"
echo "$OUT" | grep -q "anonymized 0 request" || fail "the rerun was not a no-op: $OUT"

step "erase: an open request needs --force, an unknown RMA is refused, an erased one is reported"
set +e
OUT=$(job npm run retention:erase -- --rma "$RMA_B"); RC=$?; set -e
[ "$RC" -ne 0 ] || fail "erase of an open request was not refused: $OUT"
[ "$(sql "select count(*) from return_requests where id = $ID_B and anonymized_at is null")" = 1 ] || fail "the refused erase changed B"
set +e; OUT=$(job npm run retention:erase -- --rma RMA-0000-00000); RC=$?; set -e
[ "$RC" -ne 0 ] || fail "erase of an unknown RMA succeeded: $OUT"
OUT=$(job npm run retention:erase -- --rma "$RMA_A") || fail "erase of an erased request failed: $OUT"
echo "$OUT" | grep -q "already erased" || fail "no 'already erased' answer: $OUT"

step "after: the card of A shows the erasure, no e-mail, no defect text, no photo"
ab open "$BASE_URL/admin/returns/$ID_A" >/dev/null 2>&1 || fail "cannot open card A"
wait_text "Zanonimizowano"
expect_no_text "anna.kowalska@example.pl" "card A still shows the e-mail"
expect_no_text "RET013-A" "card A still shows the defect text"
shot 03-card-closed-after
curl -s -b "$COOKIES" "$BASE_URL/admin/returns/$ID_A" -o "$FX/cardA-after.html"
grep -q "/api/evidence/$PA" "$FX/cardA-after.html" && fail "card A still links the photo"
[ "$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' "$BASE_URL/api/evidence/$PA")" = 404 ] || fail "A's photo can still be downloaded"

step "after: the inbox marks A as erased and still shows B's e-mail"
ab open "$BASE_URL/admin/returns" >/dev/null 2>&1 || fail "cannot open the inbox"
wait_text "Zanonimizowano"
expect_text "maria.lewandowska@example.pl" "the inbox lost B's e-mail"
expect_no_text "anna.kowalska@example.pl" "the inbox still shows A's e-mail"
shot 04-inbox-after

step "after: the open request B is unchanged on its card, photo included"
ab open "$BASE_URL/admin/returns/$ID_B" >/dev/null 2>&1 || fail "cannot open card B"
wait_text "maria.lewandowska@example.pl"
expect_no_text "Zanonimizowano" "card B shows an erasure"
shot 05-card-open-unchanged
[ "$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' "$BASE_URL/api/evidence/$PB")" = 200 ] || fail "B's photo can no longer be opened"

step "after: the customer of A still sees the status, without text or photo"
code=$(curl -s -b "$COOKIES.guest" -o "$FX/trackerA.html" -w '%{http_code}' "$BASE_URL/returns/$RMA_A")
[ "$code" = 200 ] || fail "tracker of A answered $code"
grep -q "RET013-A" "$FX/trackerA.html" && fail "the tracker still shows the defect text"
grep -q "/api/evidence/$PA" "$FX/trackerA.html" && fail "the tracker still links the photo"

rm -rf "$FX"
echo "PASS: $QA_ID ($RMA_A, $RMA_B)"
