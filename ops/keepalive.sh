#!/bin/bash
# Kian OS keepalive — ensures postgres + next.js + relay client are running.
# Idempotent: safe to run on a schedule (every 5 min). Run as the hatch user.
#
# PostgreSQL is a local install under /home/hatch/pg (persistent home,
# survives VM swaps) — no `su` needed.
#
# All paths/ports come from env vars (see .env.example); defaults match the
# original VM layout.
set -u
APP_DIR="${KIAN_OS_DIR:-/home/hatch/workspace/kian-os}"
OPS_DIR="$APP_DIR/ops"
LOG="$OPS_DIR/keepalive.log"
PG_CTL="${PG_CTL:-/home/hatch/pg/bin/pg_ctl}"
PGDATA="${PGDATA:-/home/hatch/pgdata/data}"
PG_LOG="${PG_LOG:-/home/hatch/pgdata/pg.log}"
PG_PORT="${PG_PORT:-5433}"
APP_PORT="${APP_PORT:-3000}"

# Proxy vars (needed for the relay client's outbound WebSocket through the sandbox proxy)
[ -f "$OPS_DIR/proxy.env" ] && . "$OPS_DIR/proxy.env"

log() { echo "$(date -Iseconds) $*" >> "$LOG"; }

# 1. postgres on :$PG_PORT (local install under /home/hatch/pg — survives VM swaps)
# Runs as the kianos OS user (initdb refuses root). A VM swap can wipe
# /etc/passwd, so recreate the user if missing — the data dir persists in ~.
id kianos >/dev/null 2>&1 || useradd -r -M -s /usr/sbin/nologin kianos
if ! su -s /bin/sh kianos -c "$PG_CTL -D $PGDATA status" >/dev/null 2>&1; then
  log "postgres down, starting"
  su -s /bin/sh kianos -c "$PG_CTL -D $PGDATA -l $PG_LOG -o '-p $PG_PORT' start" >> "$LOG" 2>&1 || log "pg_ctl start failed"
fi

# 2. next.js production server on :$APP_PORT (bound to 127.0.0.1 via `npm start`)
if ! curl -sf -o /dev/null --max-time 5 "http://localhost:$APP_PORT/login"; then
  log "next down, (re)starting"
  pkill -f "next-server" 2>/dev/null; sleep 1
  cd "$APP_DIR" || exit 1
  set -a; . ./.env; set +a
  setsid nohup npm start -- --port "$APP_PORT" >> "$OPS_DIR/next.log" 2>&1 < /dev/null &
  log "next start issued"
fi

# 3. relay client (exactly one `node client.mjs`)
N=$(pgrep -c -f '^node client\.mjs$' 2>/dev/null || true); N=${N:-0}
if [ "$N" -eq 0 ]; then
  log "relay client down, starting"
  cd "$APP_DIR/relay" || exit 1
  setsid nohup node client.mjs >> "$OPS_DIR/relay.log" 2>&1 < /dev/null &
  log "relay client start issued"
elif [ "$N" -gt 1 ]; then
  log "relay client duplicated ($N running), killing extras"
  pkill -f '^node client\.mjs$'
  sleep 2
  cd "$APP_DIR/relay" || exit 1
  setsid nohup node client.mjs >> "$OPS_DIR/relay.log" 2>&1 < /dev/null &
  log "relay client restarted cleanly"
fi
