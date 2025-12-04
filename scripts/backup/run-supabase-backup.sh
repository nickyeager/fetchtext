#!/usr/bin/env bash
set -euo pipefail

# Executes a logical backup of the Supabase Postgres database inside Docker.
# Intended to be invoked via cron on the VM hosting the stack.

BACKUP_DIR="/srv/supabase/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="supabase_backup_${TIMESTAMP}.sql"
CONTAINER_NAME="supabase-db"

while getopts ":d:c:h" opt; do
  case "$opt" in
    d) BACKUP_DIR="$OPTARG" ;;
    c) CONTAINER_NAME="$OPTARG" ;;
    h)
      cat <<'EOF'
Usage: run-supabase-backup.sh [-d <backup-dir>] [-c <postgres-container-name>]
Defaults: backup-dir=/srv/supabase/backups, container=supabase-db
EOF
      exit 0
      ;;
    *)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

echo "Ensuring backup directory $BACKUP_DIR exists"
mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container ${CONTAINER_NAME} not running. Aborting." >&2
  exit 1
fi

OUTPUT_PATH="${BACKUP_DIR}/${FILENAME}"

echo "Running pg_dumpall into $OUTPUT_PATH"
docker exec "$CONTAINER_NAME" pg_dumpall -U postgres > "$OUTPUT_PATH"

gzip "$OUTPUT_PATH"

echo "Backup complete: ${OUTPUT_PATH}.gz"
