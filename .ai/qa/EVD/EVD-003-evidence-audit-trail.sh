#!/bin/sh
# EVD-003: the audit trail of evidence photos (threat T-23): guest add and take-back, agent download with a 10 minute
# dedup window, rows tied to the request at attach, shown to agents on the decision card, never to the customer.
# Scenario: .ai/qa/EVD/EVD-003-evidence-audit-trail.md
# Priority: High. Type: API + agent UI. Role: two guest customers (PL-10001, PL-10005) and the QA agent.
# Needs the ClamAV container (`docker compose up -d --wait clamav`). Creates a report; cleanup releases its unit.
QA_ID=EVD-003
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

FX=$(mktemp -d)
node "$QA_DIR/lib/evidence-fixtures.mjs" "$FX" >/dev/null || fail "could not build the fixtures"
docker exec easyrms-clamav clamdcheck.sh >/dev/null 2>&1 || fail "the clamav container is not healthy (docker compose up -d --wait clamav)"
YESTERDAY=$(node -e 'console.log(new Date(Date.now()-864e5).toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"}))')
JAR_B="$COOKIES.guestB"
stage() { curl -s -b "$1" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$FX/${2:-ok.png}" | json_get data.id; }
rows() { db_sql "select count(*) from evidence_audit_events where evidence_file_id = '$1' and action = '$2'"; }

step "two customers, one session each, and the agent"
guest_lookup PL-10001 anna.kowalska@example.pl
curl -s -o /dev/null -c "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10005","email":"maria.lewandowska@example.pl"}'
agent_login_api
AGENT_ID=$(db_sql "select id from agents where email = '$TEST_AGENT_EMAIL'")
[ -n "$AGENT_ID" ] || fail "no QA agent row"

step "an upload leaves one guest 'added' row, not yet tied to a request"
P1=$(stage "$COOKIES.guest" ok.png); [ -n "$P1" ] || fail "no photo staged"
[ "$(rows "$P1" added)" = 1 ] || fail "expected one 'added' row, got $(rows "$P1" added)"
[ "$(db_sql "select actor || ' ' || order_number || ' ' || coalesce(return_request_id::text, 'none') from evidence_audit_events where evidence_file_id = '$P1' and action = 'added'")" = "guest PL-10001 none" ] || fail "wrong content of the 'added' row"

step "negative: a refused upload (not an image) leaves no row"
BEFORE=$(db_sql "select count(*) from evidence_audit_events")
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$FX/fake.png")
[ "$code" = 400 ] || fail "svg was not refused ($code)"
[ "$(db_sql "select count(*) from evidence_audit_events")" = "$BEFORE" ] || fail "a refused upload left an audit row"

step "a take-back by the customer leaves a 'removed' row, and the row outlives the file"
P2=$(stage "$COOKIES.guest" ok.jpg)
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$P2")
[ "$code" = 200 ] || fail "take-back answered $code"
[ "$(rows "$P2" added)" = 1 ] && [ "$(rows "$P2" removed)" = 1 ] || fail "expected one added and one removed row for the taken-back photo"
[ "$(db_sql "select count(*) from evidence_files where id = '$P2'")" = 0 ] || fail "the taken-back file is still stored"
step "negative: another customer's delete and a delete of an unknown id leave no row"
BEFORE=$(db_sql "select count(*) from evidence_audit_events")
curl -s -o /dev/null -b "$JAR_B" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/$P1"
curl -s -o /dev/null -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X DELETE "$BASE_URL/api/evidence/00000000-0000-4000-8000-000000000000"
[ "$(db_sql "select count(*) from evidence_audit_events")" = "$BEFORE" ] || fail "a refused delete left an audit row"

step "the report ties the photo's rows to its request"
OUT=$(guest_submit "{\"kind\":\"transport\",\"items\":[{\"lineRef\":\"L1\",\"quantity\":1}],\"defectDescription\":\"Karton był zgnieciony, a produkt pęknięty.\",\"defectDiscoveredOn\":\"$YESTERDAY\",\"resolution\":\"replacement\",\"evidenceFileIds\":[\"$P1\"],\"acknowledged\":true,\"idempotencyKey\":\"$(new_key)\"}")
RMA=$(printf '%s' "$OUT" | sed -n 's/.*"rma":"\(RMA-[0-9]*-[0-9]*\)".*/\1/p')
[ -n "$RMA" ] || fail "report not created: $OUT"
echo "created $RMA"
RID=$(return_id_for "$RMA")
[ "$(db_sql "select return_request_id from evidence_audit_events where evidence_file_id = '$P1' and action = 'added'")" = "$RID" ] || fail "the 'added' row was not tied to the request"

step "the customer opening their own photo is not recorded"
for n in 1 2 3; do curl -s -o /dev/null -b "$COOKIES.guest" "$BASE_URL/api/evidence/$P1"; done
[ "$(rows "$P1" downloaded)" = 0 ] || fail "a guest read left a 'downloaded' row"

step "the agent opening the photo three times leaves exactly one row (10 minute window), with the agent and the request"
for n in 1 2 3; do code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES" "$BASE_URL/api/evidence/$P1"); [ "$code" = 200 ] || fail "agent read answered $code"; done
[ "$(rows "$P1" downloaded)" = 1 ] || fail "expected one 'downloaded' row, got $(rows "$P1" downloaded)"
[ "$(db_sql "select agent_id || ' ' || return_request_id from evidence_audit_events where evidence_file_id = '$P1' and action = 'downloaded'")" = "$AGENT_ID $RID" ] || fail "wrong agent or request on the 'downloaded' row"
step "negative: another customer's read (404) and a read of an unknown id leave no row"
curl -s -o /dev/null -b "$JAR_B" "$BASE_URL/api/evidence/$P1"
curl -s -o /dev/null -b "$COOKIES" "$BASE_URL/api/evidence/00000000-0000-4000-8000-000000000000"
[ "$(rows "$P1" downloaded)" = 1 ] || fail "a refused read left a row"
step "after the window, the next agent read is recorded again"
db_sql "update evidence_audit_events set created_at = now() - interval '11 minutes' where evidence_file_id = '$P1' and action = 'downloaded'" >/dev/null
curl -s -o /dev/null -b "$COOKIES" "$BASE_URL/api/evidence/$P1"
[ "$(rows "$P1" downloaded)" = 2 ] || fail "no new row after the window"

step "agents see the history on the decision card"
curl -s -b "$COOKIES" "$BASE_URL/admin/returns/$RID" -o "$FX/card.html"
for text in "Historia zdjęć" "Klient dodał zdjęcie" "Agent otworzył zdjęcie"; do grep -q "$text" "$FX/card.html" || fail "the card does not show \"$text\""; done

step "negative: customers never see it: the tracker page, the agent's customer preview and the API answers contain no trail"
curl -s -b "$COOKIES.guest" "$BASE_URL/returns/$RMA" -o "$FX/tracker.html"
curl -s -b "$COOKIES" "$BASE_URL/admin/returns/$RID/customer-view" -o "$FX/preview.html"
for f in tracker preview; do
  [ -s "$FX/$f.html" ] || fail "$f page is empty"
  for text in "Historia zdjęć" "Agent otworzył" "Klient dodał zdjęcie" "evidence_audit" "downloaded"; do
    grep -q "$text" "$FX/$f.html" && fail "the $f page leaks the audit trail (\"$text\")"
  done
  grep -q "/api/evidence/$P1" "$FX/$f.html" || fail "the $f page lost its photo thumbnail"
done

step "the trail survives the erasure path: deleting the request's files keeps the rows"
# QA-only escape hatch on the disposable test database: the erasure method has no caller yet (T-21).
db_sql "delete from evidence_files where return_request_id = $RID" >/dev/null
[ "$(db_sql "select count(*) from evidence_audit_events where evidence_file_id = '$P1'")" -ge 3 ] || fail "audit rows vanished with the file"

rm -rf "$FX"
echo "PASS: $QA_ID ($RMA)"
