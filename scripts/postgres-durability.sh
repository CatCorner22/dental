#!/usr/bin/env bash
# PRODUCTION DATABASE DRIVE — the guarantee Postgres exists to provide.
#
# Every other probe runs on PGLITE_DIR=memory://, which is wiped on restart by
# design. Production is different: resolveDbBackend REQUIRES POSTGRES_URL when
# NODE_ENV=production (src/lib/db/backend.ts) precisely because a Vercel cold
# start would otherwise silently drop every user, draft, and filing. That
# production path — schema creation on a real Postgres, then survival across a
# restart — had never been executed before go-live prep.
#
# This boots the app in production mode against a real Postgres, writes a
# clinician's whole day (account, draft, filed submission, audit rows), kills
# the server, boots a SECOND process against the same database, and proves the
# record is still there and still readable through the app's own API.
#
#   POSTGRES_URL=postgresql://user@host:5432/db scripts/postgres-durability.sh
set -uo pipefail
cd "$(dirname "$0")/.."

: "${POSTGRES_URL:?set POSTGRES_URL to a real Postgres database}"
PORT="${PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
LOG_DIR="${LOG_DIR:-/tmp/pg-durability}"
mkdir -p "$LOG_DIR"

fails=0
check() { # check <cond-exit-code> <label>
  if [ "$1" -eq 0 ]; then echo "ok    $2"; else echo "FAIL  $2"; fails=$((fails+1)); fi
}

boot() { # boot <logfile>
  pkill -f "next-serve[r]" >/dev/null 2>&1; sleep 2
  NODE_ENV=production POSTGRES_URL="$POSTGRES_URL" \
    AUTH_SECRET=durability-secret-not-a-real-one \
    ADMIN_USERNAME=smokeadmin ADMIN_PASSWORD=smoke-pass-12345 \
    nohup npx next start -p "$PORT" > "$1" 2>&1 &
  for _ in $(seq 1 45); do curl -s -o /dev/null --max-time 2 "$BASE/login" && return 0; sleep 1; done
  return 1
}

echo "──── boot 1: schema creation on a real Postgres ────"
boot "$LOG_DIR/boot1.log"; check $? "the app boots in production mode against Postgres"
grep -qiE "error|POSTGRES_URL is required" "$LOG_DIR/boot1.log"; [ $? -ne 0 ]
check $? "boot 1 logs no database error"

# Write a clinician's day through the app's own HTTP surface.
BASE_URL="$BASE" node scripts/durability-write.mjs > "$LOG_DIR/write.log" 2>&1
check $? "wrote an account, a draft, and a filed submission through the API"
TICKET=$(grep -oE 'TICKET=[A-Za-z0-9-]+' "$LOG_DIR/write.log" | cut -d= -f2)
DRAFT=$(grep -oE 'DRAFT=[a-f0-9-]+' "$LOG_DIR/write.log" | cut -d= -f2)
echo "      (ticket ${TICKET:-none}, draft ${DRAFT:-none})"

echo "──── restart: the cold start that would wipe an in-memory deployment ────"
boot "$LOG_DIR/boot2.log"; check $? "the app boots a second time against the same database"
grep -q "schema" "$LOG_DIR/boot2.log" 2>/dev/null; [ $? -ne 0 ]
check $? "boot 2 replays no schema DDL (version-gated ensureSchema)"

BASE_URL="$BASE" TICKET="$TICKET" DRAFT="$DRAFT" \
  node scripts/durability-verify.mjs > "$LOG_DIR/verify.log" 2>&1
rc=$?
cat "$LOG_DIR/verify.log"
check $rc "every record survives the restart, readable through the API"

pkill -f "next-serve[r]" >/dev/null 2>&1
echo
[ "$fails" -eq 0 ] || { echo "$fails failure(s)"; exit 1; }
echo "Production database durability: verified."
