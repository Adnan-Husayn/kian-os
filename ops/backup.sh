#!/bin/bash
# Kian OS nightly backup — pg_dump (custom format, compressed) with rotation.
# Keeps the 7 most recent daily dumps under ops/backups/.
# Run as the hatch user. Reads connection details from the app .env.
set -u
APP_DIR="${KIAN_OS_DIR:-/home/hatch/workspace/kian-os}"
BACKUP_DIR="$APP_DIR/ops/backups"
KEEP=7
mkdir -p "$BACKUP_DIR"

set -a; . "$APP_DIR/.env"; set +a
# DATABASE_URL format: postgresql://user:pass@host:port/dbname
DB_URL="${DATABASE_URL:?DATABASE_URL not set in .env}"

STAMP="$(date +%F)"
OUT="$BACKUP_DIR/kian-os-$STAMP.dump"

PG_BIN="${PG_BIN:-/home/hatch/pg/bin}"
"$PG_BIN/pg_dump" --dbname="$DB_URL" -Fc -f "$OUT" 2>>"$BACKUP_DIR/backup.log" \
  && echo "$(date -Iseconds) backup ok: $OUT" >>"$BACKUP_DIR/backup.log" \
  || { echo "$(date -Iseconds) backup FAILED" >>"$BACKUP_DIR/backup.log"; exit 1; }

# rotation: keep newest $KEEP dumps
ls -1t "$BACKUP_DIR"/kian-os-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

# NOTE: copy the newest dump off this VM regularly (scp/rsync to your machine).
# To restore: pg_restore -d <new-db> --clean kian-os-<date>.dump
