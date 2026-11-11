#!/bin/sh
# EVD-001: evidence upload and download through the API: types by content, re-encoding without EXIF, size and count
# limits, throttle, order-scoped reads, response headers, and fail-closed behaviour with the scanner stopped.
# Scenario: .ai/qa/EVD/EVD-001-evidence-upload-and-download.md
# Priority: High. Type: API. Role: two guest customers (PL-10001, PL-10005) and the QA agent.
# Needs the ClamAV container (`docker compose up -d --wait clamav`, container easyrms-clamav). Creates no return.
QA_ID=EVD-001
. "$(cd "$(dirname "$0")/../lib" && pwd)/common.sh"
qa_init

FX=$(mktemp -d)
node "$QA_DIR/lib/evidence-fixtures.mjs" "$FX" >/dev/null || fail "could not build the fixtures"
JAR_B="$COOKIES.guestB"
up() { # <cookie jar> <file> [filename]  -> prints "<http status> <body>" (no CSRF-hostile headers: same origin fetch header)
  curl -s -o "$FX/resp.json" -w '%{http_code}' -b "$1" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$2${3:+;filename=$3}"
}
body() { cat "$FX/resp.json"; }
expect_status() { [ "$1" = "$2" ] || fail "$3: expected $2, got $1 ($(body))"; }

step "ClamAV is up"
docker exec easyrms-clamav clamdcheck.sh >/dev/null 2>&1 || fail "the clamav container is not healthy (docker compose up -d --wait clamav)"

step "two customers, one session each"
guest_lookup PL-10001 anna.kowalska@example.pl
curl -s -o /dev/null -c "$JAR_B" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/returns/lookup" --data-raw '{"orderNumber":"PL-10005","email":"maria.lewandowska@example.pl"}'

step "negative: no session is 401"
expect_status "$(up /dev/null "$FX/ok.jpg")" 401 "upload without a cookie"

step "a JPEG with GPS EXIF is accepted and answered with id, size and type"
expect_status "$(up "$COOKIES.guest" "$FX/ok.jpg" "../../etc/passwd.jpg")" 201 "valid jpeg"
ID_A=$(body | json_get data.id)
[ -n "$ID_A" ] || fail "no id in the answer: $(body)"
[ "$(body | json_get data.contentType)" = "image/jpeg" ] || fail "wrong type: $(body)"

step "the download carries the hardening headers and no metadata"
curl -s -D "$FX/headers.txt" -o "$FX/downloaded.jpg" -b "$COOKIES.guest" "$BASE_URL/api/evidence/$ID_A"
H=$(tr -d '\r' < "$FX/headers.txt" | tr 'A-Z' 'a-z')
echo "$H" | grep -q '^http/[0-9.]* 200' || fail "download did not answer 200: $(head -1 "$FX/headers.txt")"
echo "$H" | grep -q '^content-type: image/jpeg$' || fail "content-type"
echo "$H" | grep -q '^x-content-type-options: nosniff$' || fail "nosniff missing"
echo "$H" | grep -q "^content-disposition: inline; filename=\"evidence-$ID_A.jpg\"$" || fail "content-disposition must use the generated name"
echo "$H" | grep -q "^content-security-policy: default-src 'none'; sandbox$" || fail "csp missing"
echo "$H" | grep -q '^cache-control: private, no-store$' || fail "cache-control"
grep -q "QaCam" "$FX/downloaded.jpg" && fail "the camera name survived re-encoding"
grep -q "Kowalski" "$FX/downloaded.jpg" && fail "the copyright survived re-encoding"
(cd "$ROOT/packages/app" && node -e 'require("sharp")(process.argv[1]).metadata().then(m=>{if(m.exif||m.icc){console.error("metadata left");process.exit(1)}})' "$FX/downloaded.jpg") || fail "EXIF or ICC left in the download"

step "the stored row holds a hash and the re-encoded bytes, never the original name in the label path"
ROW=$(db_sql "select content_type || ' ' || byte_size || ' ' || length(sha256) || ' ' || label from evidence_files where id = '$ID_A'")
case "$ROW" in "image/jpeg "*" 64 "*) ;; *) fail "unexpected row: $ROW" ;; esac
LABEL=$(db_sql "select label from evidence_files where id = '$ID_A'")
[ "$LABEL" = "passwd.jpg" ] || fail "the label must be the last path segment only, got: $LABEL"

step "PNG and WebP are accepted too"
expect_status "$(up "$COOKIES.guest" "$FX/ok.png")" 201 "png"
expect_status "$(up "$COOKIES.guest" "$FX/ok.webp")" 201 "webp"

step "negative: judged by content, not by name or declared type"
expect_status "$(up "$COOKIES.guest" "$FX/fake.png")" 400 "svg named .png"
[ "$(body | json_get error.code)" = "not_an_image" ] || fail "code: $(body)"
expect_status "$(up "$COOKIES.guest" "$FX/page.html" photo.jpg)" 400 "html named .jpg"
expect_status "$(up "$COOKIES.guest" "$FX/eicar.txt")" 400 "the EICAR text string is not an image, so it never reaches the scanner"

step "negative: extreme dimensions are rejected before decoding (422), oversize is 413"
expect_status "$(up "$COOKIES.guest" "$FX/bigdims.png")" 422 "pixel flood"
[ "$(body | json_get error.code)" = "rejected" ] || fail "code: $(body)"
expect_status "$(up "$COOKIES.guest" "$FX/oversize.jpg")" 413 "6 MB file"
[ "$(body | json_get error.code)" = "too_large" ] || fail "code: $(body)"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: multipart/form-data; boundary=x' -H 'content-length: 99999999' -X POST "$BASE_URL/api/evidence" --data-binary 'x')
[ "$code" = 413 ] || fail "a declared huge body answered $code"

step "negative: a body that is not multipart, and two files in one request, are 400"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" -H 'x-requested-with: fetch' -H 'content-type: application/json' -X POST "$BASE_URL/api/evidence" --data-raw '{}')
[ "$code" = 400 ] || fail "json body answered $code"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" -H 'x-requested-with: fetch' -X POST "$BASE_URL/api/evidence" -F "file=@$FX/ok.png" -F "file=@$FX/ok.webp")
[ "$code" = 400 ] || fail "two files answered $code"

step "negative: the count limit (6 per report): fill up to six, the seventh is 409"
for n in 4 5 6; do expect_status "$(up "$COOKIES.guest" "$FX/ok.png")" 201 "photo $n"; done
expect_status "$(up "$COOKIES.guest" "$FX/ok.png")" 409 "seventh photo"
[ "$(body | json_get error.code)" = "quota_exceeded" ] || fail "code: $(body)"

step "reads are order-scoped: the other customer, no cookie and an unknown id all get the same 404"
curl -s -o "$FX/other.json" -w '%{http_code}' -b "$JAR_B" "$BASE_URL/api/evidence/$ID_A" > "$FX/other.code"
curl -s -o "$FX/none.json" -w '%{http_code}' "$BASE_URL/api/evidence/$ID_A" > "$FX/none.code"
curl -s -o "$FX/unknown.json" -w '%{http_code}' -b "$COOKIES.guest" "$BASE_URL/api/evidence/00000000-0000-4000-8000-000000000000" > "$FX/unknown.code"
for f in other none unknown; do [ "$(cat "$FX/$f.code")" = 404 ] || fail "$f answered $(cat "$FX/$f.code")"; done
cmp -s "$FX/other.json" "$FX/none.json" && cmp -s "$FX/none.json" "$FX/unknown.json" || fail "the three 404 bodies differ, so existence leaks"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES.guest" "$BASE_URL/api/evidence/not-a-uuid")
[ "$code" = 404 ] || fail "a malformed id answered $code"

step "an agent can read any file"
agent_login_api
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES" "$BASE_URL/api/evidence/$ID_A")
[ "$code" = 200 ] || fail "agent read answered $code"

step "negative: the other customer's quota and budget are separate; junk spends the throttle budget (429)"
last=0
for n in $(seq 1 25); do last=$(up "$JAR_B" "$FX/tiny.txt"); [ "$last" = 429 ] && break; done
[ "$last" = 429 ] || fail "no 429 after 25 uploads from one order and IP (last: $last)"
[ "$(body | json_get error.code)" = "rate_limited" ] || fail "code: $(body)"

step "fail closed: with the scanner stopped an upload is 503 and stores nothing"
db_sql "delete from rate_limit_windows" >/dev/null
BEFORE=$(db_sql "select count(*) from evidence_files where order_number = 'PL-10005'")
docker stop easyrms-clamav >/dev/null
trap 'docker start easyrms-clamav >/dev/null 2>&1 || true; qa_cleanup' EXIT INT TERM
expect_status "$(up "$JAR_B" "$FX/ok.png")" 503 "scanner stopped"
[ "$(body | json_get error.code)" = "scanner_unavailable" ] || fail "code: $(body)"
[ "$(db_sql "select count(*) from evidence_files where order_number = 'PL-10005'")" = "$BEFORE" ] || fail "a file was stored while the scanner was down"

step "recovery: with the scanner back the same upload succeeds"
docker start easyrms-clamav >/dev/null
n=0; until docker exec easyrms-clamav clamdcheck.sh >/dev/null 2>&1; do n=$((n + 1)); [ "$n" -gt 60 ] && fail "clamav did not come back"; sleep 2; done
expect_status "$(up "$JAR_B" "$FX/ok.png")" 201 "after recovery"

rm -rf "$FX"
echo "PASS: $QA_ID"
