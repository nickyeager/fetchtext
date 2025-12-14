#!/usr/bin/env bash
set -euo pipefail

# start_document_processor.sh
# Ensures the document-processor container is built, running, attached to the 'local-ai' network, and healthy.
# Idempotent: safe to re-run.

SERVICE_NAME="document-processor"
CONTAINER_NAME="localai-document-processor"
NETWORK_NAME="local-ai"
HEALTH_URL="http://localhost:8090/health"
MAX_WAIT=30

log() { printf "[start-document-processor] %s\n" "$*"; }
fail() { printf "[start-document-processor][ERROR] %s\n" "$*" >&2; exit 1; }

# 1. Ensure docker CLI available
command -v docker >/dev/null 2>&1 || fail "docker CLI not found in PATH. Open a login shell or install Docker Desktop."

# 2. Ensure network exists
if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  log "Creating network $NETWORK_NAME"
  docker network create "$NETWORK_NAME" >/dev/null
else
  log "Network $NETWORK_NAME already exists"
fi

# 3. Build & start service via compose
log "(Re)starting service $SERVICE_NAME"
docker compose up -d --build "$SERVICE_NAME"

# 4. Verify container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  fail "Container ${CONTAINER_NAME} not found after compose up. Check docker compose logs."
fi

# 5. Ensure network attachment (attach if not present)
if ! docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER_NAME" | grep -qw "$NETWORK_NAME"; then
  log "Attaching $CONTAINER_NAME to $NETWORK_NAME"
  docker network connect "$NETWORK_NAME" "$CONTAINER_NAME" || fail "Failed to attach container to network."
else
  log "Container already attached to $NETWORK_NAME"
fi

# 6. Health probe loop
log "Probing health endpoint: $HEALTH_URL"
for i in $(seq 1 "$MAX_WAIT"); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)
  if [ "$code" = 200 ]; then
    log "Health OK (200)"; break
  fi
  log "Waiting for health... attempt $i status=$code"
  sleep 1
  if [ "$i" = "$MAX_WAIT" ]; then
    log "Health check failed after $MAX_WAIT seconds"
    docker compose logs --tail=100 "$SERVICE_NAME" || true
    exit 1
  fi
done

# 7. Summary
log "Container: $CONTAINER_NAME"
log "Networks: $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER_NAME")"
log "Done."
