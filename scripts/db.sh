#!/usr/bin/env bash
# Local PostgreSQL for development: ./scripts/db.sh start|stop|status
# Uses the system PostgreSQL binaries; data lives in .data/postgres (git-ignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.data/postgres"
PORT="${EASYRMS_DB_PORT:-5433}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -n "$PGBIN" ] || PGBIN="$(dirname "$(command -v pg_ctl)")"

case "${1:-}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DATA"
      "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
    fi
    if ! "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      "$PGBIN/pg_ctl" -D "$DATA" -l "$ROOT/.data/postgres.log" \
        -o "-p $PORT -k /tmp -c listen_addresses=localhost" -w start >/dev/null
    fi
    PSQL=("$PGBIN/psql" -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qtA)
    "${PSQL[@]}" -c "SELECT 1 FROM pg_roles WHERE rolname='easyrms'" | grep -q 1 \
      || "${PSQL[@]}" -c "CREATE ROLE easyrms LOGIN PASSWORD 'easyrms' CREATEDB"
    "${PSQL[@]}" -c "SELECT 1 FROM pg_database WHERE datname='easyrms'" | grep -q 1 \
      || "${PSQL[@]}" -c "CREATE DATABASE easyrms OWNER easyrms"
    echo "PostgreSQL running on localhost:$PORT (postgres://easyrms:easyrms@localhost:$PORT/easyrms)"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DATA" -m fast stop
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$DATA" status
    ;;
  *)
    echo "usage: $0 start|stop|status" >&2
    exit 1
    ;;
esac
