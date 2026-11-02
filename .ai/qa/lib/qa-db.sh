# Fresh-database helpers for the QA scenarios. Source it, do not execute it. Needs $ROOT and $QA_DIR.
#
# Every scenario runs against its own copy of a pristine database:
#   easyrms_qa_template  migrated schema + the QA agent (TEST_AGENT_EMAIL, copied once from the dev database `easyrms`)
#   easyrms_qa           what the test app uses; dropped and re-created from the template by qa_db_reset
# so no scenario can see rows, held units, throttle windows or agents left by an earlier one, and the QA runs never touch the
# developer's own `easyrms` database. The template is rebuilt when the migrations change (fingerprint kept as its comment).
#
# QA-only: this drops databases. It only ever drops $QA_DB_NAME. Override with EASYRMS_QA_DB_BASE (no database name, no slash).

QA_PG_BASE="${EASYRMS_QA_DB_BASE:-postgres://easyrms:easyrms@localhost:5433}"
QA_DB_NAME=easyrms_qa
QA_DB_TEMPLATE=easyrms_qa_template
QA_DEV_DB=easyrms
QA_DB_URL="$QA_PG_BASE/$QA_DB_NAME"

# qa_psql <database> <sql> [extra psql args]: runs SQL; psql when installed, else inside the docker compose postgres.
qa_psql() {
  _db=$1; _sql=$2; shift 2
  if command -v psql >/dev/null 2>&1; then
    psql "$QA_PG_BASE/$_db" -v ON_ERROR_STOP=1 -qtAc "$_sql" "$@"
  else
    (cd "$ROOT" && docker compose exec -T postgres psql -U easyrms -d "$_db" -v ON_ERROR_STOP=1 -qtAc "$_sql" "$@" </dev/null)
  fi
}

qa_migrations_fingerprint() { (cd "$ROOT/packages/db/src/migrations" && cat *.ts | cksum | awk '{print $1":"$2}'); }

qa_db_ensure_template() {
  fp=$(qa_migrations_fingerprint)
  have=$(qa_psql postgres "SELECT coalesce(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname='$QA_DB_TEMPLATE'" 2>/dev/null || true)
  [ "$have" = "$fp" ] && return 0
  echo "qa-db: building $QA_DB_TEMPLATE (migrations $fp)"
  [ -n "${TEST_AGENT_EMAIL:-}" ] || { echo "qa-db: TEST_AGENT_EMAIL not set (see .ai/qa/test-env.env)" >&2; return 1; }
  qa_psql postgres "DROP DATABASE IF EXISTS $QA_DB_TEMPLATE WITH (FORCE)" >/dev/null &&
  qa_psql postgres "CREATE DATABASE $QA_DB_TEMPLATE" >/dev/null || return 1
  (cd "$ROOT" && EASYRMS_DATABASE_URL="$QA_PG_BASE/$QA_DB_TEMPLATE" npm run db:migrate >/dev/null) || { echo "qa-db: migrating the template failed" >&2; return 1; }
  # The agent needs a password set through an invite, which needs a running app: take the finished row from the dev database.
  cols="id,email,display_name,password_hash,permissions,status,session_epoch,created_at,updated_at,accepted_at"
  row=$(qa_psql "$QA_DEV_DB" "COPY (SELECT $cols FROM agents WHERE email='$TEST_AGENT_EMAIL' AND status='active' AND password_hash IS NOT NULL) TO STDOUT")
  [ -n "$row" ] || { echo "qa-db: no active agent $TEST_AGENT_EMAIL with a password in database $QA_DEV_DB (create it with npm run agent:create, accept the invite)" >&2; return 1; }
  # Insert through a literal file: COPY ... FROM STDIN does not survive the one-shot psql -c wrapper.
  tmp=$(mktemp)
  printf 'COPY agents (%s) FROM STDIN;\n%s\n\\.\nSELECT setval(pg_get_serial_sequence($$agents$$, $$id$$), (SELECT max(id) FROM agents));\n' "$cols" "$row" > "$tmp"
  if command -v psql >/dev/null 2>&1; then psql "$QA_PG_BASE/$QA_DB_TEMPLATE" -v ON_ERROR_STOP=1 -q -f "$tmp" >/dev/null
  else (cd "$ROOT" && docker compose exec -T postgres psql -U easyrms -d "$QA_DB_TEMPLATE" -v ON_ERROR_STOP=1 -q <"$tmp" >/dev/null)
  fi || { rm -f "$tmp"; echo "qa-db: seeding the QA agent failed" >&2; return 1; }
  rm -f "$tmp"
  qa_psql postgres "COMMENT ON DATABASE $QA_DB_TEMPLATE IS '$fp'" >/dev/null
}

# Drops easyrms_qa (closing the test app's connections; its pool reconnects on the next query) and clones the template.
qa_db_reset() {
  qa_db_ensure_template || return 1
  qa_psql postgres "DROP DATABASE IF EXISTS $QA_DB_NAME WITH (FORCE)" >/dev/null &&
  qa_psql postgres "CREATE DATABASE $QA_DB_NAME TEMPLATE $QA_DB_TEMPLATE" >/dev/null
}
