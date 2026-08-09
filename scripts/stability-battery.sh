#!/usr/bin/env bash
# Full stability battery — every standing e2e probe, each against a FRESHLY
# BOOTED server so no probe inherits another's database state.
#
#   scripts/stability-battery.sh [repeats]
#
# `repeats` (default 1) runs the whole battery N times: a probe that passes
# once and fails on the second identical run is a flake, and a flake at
# go-live is either an unreliable app or an unreliable test — both worth
# knowing before clinicians depend on it.
#
# Requires a production build (npm run build) and Chromium. The cross-browser
# smoke needs Firefox/WebKit and stays CI's job.
set -uo pipefail
cd "$(dirname "$0")/.."

REPEATS="${1:-1}"
PORT="${PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
LOG_DIR="${LOG_DIR:-/tmp/stability-battery}"
mkdir -p "$LOG_DIR"

COMMON_ENV=(
  AUTH_SECRET=battery-secret-not-a-real-one
  ADMIN_USERNAME=smokeadmin
  ADMIN_PASSWORD=smoke-pass-12345
  PGLITE_DIR=memory://
  # `next start` is a production build, and production refuses an in-memory
  # database without this deliberate opt-in. A harness can say so explicitly;
  # an operator pasting env vars never types it by accident.
  ALLOW_EPHEMERAL_DB=1
  MFA_ENABLED=1
)
# The output artery needs a mail sink target and the assist switches; the probe
# hosts the sink itself on 3199.
EMAIL_ASSIST_ENV=(
  RESEND_BASE_URL=http://127.0.0.1:3199
  RESEND_API_KEY=re_test_123
  "EMAIL_FROM=Smile Notes <notes@example.test>"
  CORPORATE_EMAIL=records@example.test
  ASSIST_ENABLED=1
  AI_GATEWAY_API_KEY=dummy-key-for-gates
)

stop_server() { pkill -f "next-serve[r]" >/dev/null 2>&1; sleep 2; }

start_server() { # start_server <extra env...>
  stop_server
  env "${COMMON_ENV[@]}" "$@" nohup npx next start -p "$PORT" \
    > "$LOG_DIR/server.log" 2>&1 &
  for _ in $(seq 1 45); do
    curl -s -o /dev/null --max-time 2 "$BASE/" && return 0
    sleep 1
  done
  echo "SERVER FAILED TO START" >&2
  tail -20 "$LOG_DIR/server.log" >&2
  return 1
}

PASS=(); FAIL=()

run_probe() { # run_probe <name> [extra server env...]
  local name="$1"; shift
  printf '%-26s ' "$name"
  if ! start_server "$@"; then FAIL+=("$name (server)"); echo "SERVER-FAIL"; return; fi
  local log="$LOG_DIR/${name}.log"
  if BASE_URL="$BASE" timeout 900 node "e2e/${name}.mjs" > "$log" 2>&1; then
    local n; n=$(grep -c '^ok' "$log" 2>/dev/null || echo 0)
    PASS+=("$name"); echo "PASS (${n} checks)"
  else
    FAIL+=("$name"); echo "FAIL"
    grep -E '^FAIL|Error:|failure\(s\)' "$log" | head -4 | sed 's/^/      /'
  fi
}

for round in $(seq 1 "$REPEATS"); do
  echo "════ battery round ${round}/${REPEATS} ════"

  # Plain configuration: the bulk of the suite.
  for p in headers prehydration.login hydration.clean ttfa lockout \
           account.lifecycle mfa.totp conflict dictation \
           submission.immutability export.aioff phi.mask-override; do
    run_probe "$p"
  done

  # The output artery + assist gates need their own switches.
  run_probe email.assist "${EMAIL_ASSIST_ENV[@]}"

  # First boot wants an EMPTY deployment: no seeded admin, its own port.
  printf '%-26s ' "setup.firstboot"
  stop_server
  env AUTH_SECRET=battery-secret-not-a-real-one PGLITE_DIR=memory:// ALLOW_EPHEMERAL_DB=1 \
    nohup npx next start -p 3101 > "$LOG_DIR/server-firstboot.log" 2>&1 &
  for _ in $(seq 1 45); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3101/ && break; sleep 1; done
  if BASE_URL=http://127.0.0.1:3101 timeout 300 node e2e/setup.firstboot.mjs \
       > "$LOG_DIR/setup.firstboot.log" 2>&1; then
    PASS+=("setup.firstboot"); echo "PASS ($(grep -c '^ok' "$LOG_DIR/setup.firstboot.log") checks)"
  else
    FAIL+=("setup.firstboot"); echo "FAIL"
    grep -E '^FAIL|Error:' "$LOG_DIR/setup.firstboot.log" | head -4 | sed 's/^/      /'
  fi
done

stop_server
echo
echo "════ battery summary ════"
echo "passed: ${#PASS[@]}"
echo "failed: ${#FAIL[@]}"
for f in ${FAIL+"${FAIL[@]}"}; do echo "  FAIL  $f"; done
echo "logs: $LOG_DIR"
[ "${#FAIL[@]}" -eq 0 ] || exit 1
echo "ALL PROBES GREEN"
